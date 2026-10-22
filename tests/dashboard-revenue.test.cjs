// Ce que ce fichier garde : la mise en forme des revenus du tableau de bord,
// c'est-a-dire les deux pieges que l'ecran a payes.
//
//   1. UNE FENETRE EN JOURS APPLIQUEE A DES LIGNES MENSUELLES. La page
//      ecartait la ligne de `admin_dashboard_revenue` dont le premier jour du
//      mois tombait avant `aujourd'hui - periode`. Consulte le 22 d'un mois,
//      « 7 derniers jours » ecartait le mois en cours tout entier : « Revenus
//      encaisses » affichait zero sur un projet qui encaissait. Le repli ne
//      decoupe donc plus rien : douze mois, annonces comme tels.
//   2. UNE CLE MANQUANTE LUE COMME UN ZERO. Une base portant la version
//      precedente de `admin_dashboard_counts()` ne rend pas `revenue_series` ;
//      la lire comme une serie vide reafficherait « aucun revenu ».
//      `periodRevenueFromRow()` doit repondre `null`, ce qui fait retomber
//      l'ecran sur les mois.
//
// ⚠️ VERIFIE PAR MUTATION. Chaque assertion ci-dessous echoue si l'on
// reintroduit le defaut qu'elle garde :
//   • remettre un `if (new Date(row.mois) < cutoff) continue;` dans
//     `monthlySeries()` -> « le repli ne decoupe pas des mois » tombe ;
//   • remplacer `if (!series ...) return null` par `series ?? []` dans
//     `periodRevenueFromRow()` -> « une cle absente n'est pas un zero » tombe ;
//   • compter les transactions hors du repliage (sur toutes les lignes au lieu
//     des douze retenues) -> « montant et transactions sortent des memes
//     lignes » tombe.
//
// ⚠️ CE QU'IL NE COUVRE PAS. Le fenetrage lui-meme est fait en SQL
// (`202610230001_admin_dashboard_period.sql`) et n'est pas rejouable ici :
// aucune assertion de ce fichier ne dit que la fonction Postgres borne
// correctement `paid_at`. Elle a ete verifiee contre un Postgres reel, en
// recoupant la somme des barres avec une requete directe sur la meme fenetre.
// Ce fichier garde la couche JavaScript, et elle seule.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return resolveFilename.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
Module._extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const {
  monthlySeries,
  periodRevenueFromRow,
} = require('../lib/queries/dashboard-revenue.ts');

/** Une ligne de la vue mensuelle de l'app mobile. */
const month = (mois, payment_type, revenu_encaisse, nb_transactions_reussies) =>
  ({ mois, payment_type, revenu_encaisse, nb_transactions_reussies });

test('le repli ne decoupe pas des mois avec une fenetre en jours', () => {
  // Le mois en cours et les deux precedents. C'est exactement le cas ou
  // l'ancien filtre rendait zero : consulte en milieu de mois avec une
  // periode de 7 jours, le premier du mois est anterieur a la borne.
  const rows = [
    month('2026-08-01T00:00:00+00:00', 'abonnement', 100, 4),
    month('2026-09-01T00:00:00+00:00', 'abonnement', 200, 8),
    month('2026-10-01T00:00:00+00:00', 'abonnement', 300, 12),
  ];

  const series = monthlySeries(rows);
  assert.equal(series.length, 3, 'les trois mois doivent survivre au repliage');
  assert.equal(
    series.reduce((sum, row) => sum + row.abonnement + row.scoutDay, 0),
    600,
    "le mois en cours ne doit pas disparaitre : c'etait le defaut",
  );
  // Et l'ordre est chronologique, pour que le graphique se lise de gauche a
  // droite plutot que dans l'ordre de la reponse PostgREST.
  assert.deepEqual(
    series.map((row) => row.bucket),
    rows.map((row) => row.mois),
  );
});

test('montant et transactions sortent des memes lignes', () => {
  // Treize mois : le repliage n'en garde que douze. Le panier moyen divise le
  // montant retenu par les transactions retenues — c'est le defaut corrige,
  // ou le montant etait borne et le compte ne l'etait pas.
  const rows = [];
  for (let i = 0; i < 13; i += 1) {
    const mois = `2025-${String(i + 1).padStart(2, '0')}-01T00:00:00+00:00`;
    rows.push(month(mois, 'abonnement', 10, 1));
  }

  const series = monthlySeries(rows);
  assert.equal(series.length, 12, 'douze mois au plus');
  const amount = series.reduce((sum, row) => sum + row.abonnement + row.scoutDay, 0);
  const transactions = series.reduce((sum, row) => sum + row.abonnementTx + row.scoutDayTx, 0);
  assert.equal(amount, 120);
  assert.equal(transactions, 12, 'les transactions sont bornees comme le montant');
  assert.equal(amount / transactions, 10, 'panier moyen juste');
  // Le mois le plus ancien est celui qui tombe, pas le plus recent.
  assert.equal(series[0].bucket, '2025-02-01T00:00:00+00:00');
});

test('les deux types de paiement sont separes, puis additionnes', () => {
  const series = monthlySeries([
    month('2026-10-01T00:00:00+00:00', 'abonnement', 100, 5),
    month('2026-10-01T00:00:00+00:00', 'scout_day', 40, 2),
  ]);
  assert.equal(series.length, 1, 'un seul mois, deux lignes repliees');
  assert.deepEqual(series[0], {
    bucket: '2026-10-01T00:00:00+00:00',
    abonnement: 100,
    scoutDay: 40,
    abonnementTx: 5,
    scoutDayTx: 2,
  });
});

test('une cle absente n\'est pas un zero', () => {
  // Une base portant la version precedente de la fonction : elle rend bien les
  // autres cles, mais pas la serie.
  assert.equal(
    periodRevenueFromRow({ payments_period_total: 12, payments_period_succeeded: 10 }),
    null,
    'sans serie, pas de revenus fenetres — surtout pas une serie vide',
  );
  // Une serie sans fenetre lisible ne vaut rien non plus : l'ecran afficherait
  // un montant sans pouvoir dire sur quelle periode.
  assert.equal(
    periodRevenueFromRow({ revenue_series: [], revenue_bucket: 'jour' }),
    null,
    'une serie sans borne basse ne peut pas etre annoncee',
  );
  // Un pas de temps inconnu : la fonction a change de vocabulaire, on ne
  // devine pas comment etiqueter les barres.
  assert.equal(
    periodRevenueFromRow({
      revenue_series: [],
      revenue_bucket: 'trimestre',
      revenue_from: '2026-10-01T00:00:00+00:00',
    }),
    null,
  );
});

test('une serie vide est une reponse, pas une absence', () => {
  // Une periode reellement sans encaissement. L'ecran doit afficher sa
  // fenetre et un graphique vide, pas retomber sur douze mois.
  const result = periodRevenueFromRow({
    revenue_series: [],
    revenue_bucket: 'jour',
    revenue_from: '2026-10-16T00:00:00+00:00',
    revenue_previous_total: 145,
    payments_period_total: 0,
    payments_period_succeeded: 0,
  });
  assert.ok(result, 'une fenetre sans revenu reste une fenetre');
  assert.deepEqual(result.rows, []);
  assert.equal(result.from, '2026-10-16T00:00:00+00:00');
  assert.equal(result.previousTotal, 145);
});

test('les montants numeriques de Postgres arrivent en chaines et sont convertis', () => {
  // `numeric` traverse PostgREST en chaine : additionner sans convertir
  // concatenerait (« 10 » + « 20 » = « 1020 »).
  const result = periodRevenueFromRow({
    revenue_bucket: 'semaine',
    revenue_from: '2026-09-21T00:00:00+00:00',
    revenue_previous_total: '720.00',
    payments_period_total: '32',
    payments_period_succeeded: '29',
    revenue_series: [
      {
        bucket: '2026-09-21T00:00:00+00:00',
        abonnement: '10.50',
        scout_day: null,
        abonnement_tx: '2',
        scout_day_tx: null,
      },
    ],
  });
  assert.equal(result.bucket, 'semaine');
  assert.equal(result.previousTotal, 720);
  assert.equal(result.paymentsTotal, 32);
  assert.equal(result.paymentsSucceeded, 29);
  assert.deepEqual(result.rows[0], {
    bucket: '2026-09-21T00:00:00+00:00',
    abonnement: 10.5,
    scoutDay: 0,
    abonnementTx: 2,
    scoutDayTx: 0,
  });
});
