// Ce que ce fichier garde : le calcul des revenus de l'ecran des finances,
// c'est-a-dire les quatre endroits ou un chiffre faux passerait inapercu.
//
//   1. UN ENCAISSEMENT SANS DATE. `payments.paid_at` est nullable ; un
//      paiement passe a « reussi » sans date reste encaisse. Le compter dans
//      un mois le daterait a tort, l'oublier ferait diverger la tuile
//      « Encaisse » de la somme des mois sans que rien ne l'explique. Il sort
//      donc a part (`undatedTotal` / `undatedTransactions`).
//   2. UNE EVOLUTION SANS REFERENCE. Le mois precedent peut n'avoir rien
//      encaisse — c'est le cas du projet aujourd'hui. Diviser par zero rend
//      `Infinity`, et « +∞ % » n'est pas une mesure : la reponse doit etre
//      `null`, et l'ecran dit alors qu'il n'y a pas de reference.
//   3. UNE PROJECTION LE DERNIER JOUR DU MOIS. Le prorata vaut alors le mois
//      lui-meme : l'annoncer comme une projection ferait passer un
//      encaissement acquis pour une estimation.
//   4bis. UN PAS DE GRAPHIQUE FIXE. Au mois, un projet qui n'encaisse que
//      depuis un mois n'obtient qu'une colonne pleine largeur : une colonne
//      unique n'est pas une serie. Le pas descend donc au jour tant que les
//      encaissements tiennent dans deux mois civils, et les pas vides sont
//      conserves — les retirer resserrerait l'axe au point de faire croire a
//      une activite continue.
//   4ter. UNE DATE DE PAS LUE EN UTC. `new Date("2026-10-23")` est minuit
//      UTC : a l'ouest de Greenwich la colonne du 23 s'intitule « 22 oct ».
//      Les debuts de pas portent donc un `T00:00:00` explicite.
//   4quater. UN FILTRE QUI SE REFERME SUR LUI-MEME. La liste des mois
//      proposes est construite dans la meme boucle que les totaux. La borner
//      a la portee ne laisserait qu'une option — celle deja choisie — et il
//      n'y aurait plus moyen de revenir a « tous les mois ».
//   4quinquies. UNE PROJECTION SUR UN MOIS CLOS. Son total est acquis ; le
//      prolonger au prorata afficherait une estimation la ou il y a un fait,
//      et un mois clos n'est de toute facon pas « a 23 jours sur 31 ».
//   4. DEUX HORODATAGES A DECALAGES DIFFERENTS. PostgREST rend un decalage
//      explicite ; compares comme des chaines, `…T23:00:00+00:00` et
//      `…T00:30:00+02:00` se classent a l'envers de leur ordre reel. La
//      fenetre annoncee en bas du panneau serait fausse.
//
// ⚠️ VERIFIE PAR MUTATION. Chaque assertion echoue si l'on reintroduit le
// defaut qu'elle garde :
//   • supprimer le `continue` du cas `!row.paid_at` -> « un encaissement sans
//     date sort a part » tombe (il entre dans le mois courant) ;
//   • remplacer la garde `previousMonth.total > 0` par une division seche ->
//     « pas d'evolution sans reference » tombe (`Infinity` au lieu de `null`) ;
//   • retirer `elapsedDays < monthDays` de la condition de projection ->
//     « pas de projection le dernier jour » tombe ;
//   • revenir a une comparaison de chaines pour `firstPaidAt` / `lastPaidAt`
//     -> « les bornes se classent sur l'horodatage » tombe ;
//   • compter les paiements non encaisses -> « seuls deux statuts encaissent »
//     tombe ;
//   • figer le pas au mois (`const daily = false`) -> « le pas descend au
//     jour » tombe ;
//   • ne garder que les pas non vides -> « les pas vides sont conserves »
//     tombe ;
//   • retirer le `T00:00:00` de `localStart()` -> « un debut de pas se lit en
//     heure locale » tombe (sous un fuseau negatif) ;
//   • faire partir le prolongement du jour suivant -> « le prolongement part
//     du dernier point reel » tombe ;
//   • compter les mois du filtre apres le filtrage de portee -> « la liste des
//     mois reste complete » tombe ;
//   • garder `now.getDate()` comme jours ecoules sur un mois clos -> « un mois
//     clos est entierement ecoule » tombe. ⚠️ C'EST CETTE MUTATION, ET PAS
//     UNE AUTRE, qui garde l'absence de projection sur un mois clos : le
//     terme `isCurrentMonth` de la condition est redondant (un mois clos a
//     `elapsedDays === monthDays`), donc le retirer ne fait rien tomber. Il
//     est garde comme enonce d'intention, pas comme garde-fou ;
//   • laisser `parseMonth()` accepter un mois futur -> « un mois futur
//     retombe sur tous les mois » tombe.
//
// ⚠️ CE QU'IL NE COUVRE PAS. Rien ici ne dit que la lecture Supabase ramene
// les bonnes lignes : le plafond (`FINANCE_METRICS_LIMIT`), son tri et son
// `count` vivent dans `components/admin/finances/pieces.tsx` et ne sont pas
// rejouables sans base. Ce fichier garde le calcul, et lui seul. Il ne dit
// rien non plus du rendu : que la projection affiche sa methode est une regle
// de `revenue-stats.tsx`, pas de ce module.
process.env.TZ = 'UTC'; // les mois sont decoupes en heure locale.

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

const { financeRevenueStats, parseMonth } = require('../lib/queries/finance-stats.ts');

/** Une ligne de `public.payments`, telle que l'ecran la lit. */
const payment = (amount, payment_type, status, paid_at, currency = 'TND') =>
  ({ amount, payment_type, status, paid_at, currency });

/** Le 23 octobre 2026, midi : 23 jours ecoules sur 31. */
const OCTOBER_23 = new Date(2026, 9, 23, 12);

test('les deux types sont decomposes : montant, transactions, panier moyen, part', () => {
  const stats = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
    payment('50.00', 'abonnement', 'active_manuellement', '2026-10-06T10:00:00+00:00'),
    payment('150.00', 'scout_day', 'reussi', '2026-10-07T10:00:00+00:00'),
  ], OCTOBER_23);

  assert.equal(stats.total, 300);
  assert.equal(stats.transactions, 3);

  const [abonnement, scoutDay] = stats.byType;
  assert.equal(abonnement.type, 'abonnement');
  assert.equal(abonnement.total, 150);
  assert.equal(abonnement.transactions, 2);
  assert.equal(abonnement.average, 75);
  assert.equal(abonnement.share, 0.5);
  assert.equal(scoutDay.total, 150);
  assert.equal(scoutDay.average, 150);

  // Le panier moyen d'un type sans transaction n'est pas zero : il n'existe
  // pas. `0` se lirait comme « des ventes a 0 TND ».
  const empty = financeRevenueStats([], OCTOBER_23);
  assert.equal(empty.byType[0].average, null);
  assert.equal(empty.byType[0].share, 0);
});

test('seuls deux statuts encaissent', () => {
  const stats = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
    payment('999.00', 'abonnement', 'en_attente', '2026-10-05T10:00:00+00:00'),
    payment('999.00', 'scout_day', 'echoue', '2026-10-05T10:00:00+00:00'),
    payment('999.00', 'scout_day', 'rembourse', '2026-10-05T10:00:00+00:00'),
  ], OCTOBER_23);

  assert.equal(stats.total, 100);
  assert.equal(stats.transactions, 1);
});

test('un encaissement sans date sort a part, il n\'entre dans aucun mois', () => {
  const stats = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
    payment('40.00', 'scout_day', 'reussi', null),
  ], OCTOBER_23);

  assert.equal(stats.total, 100);
  assert.equal(stats.focusMonth.total, 100);
  assert.equal(stats.undatedTotal, 40);
  assert.equal(stats.undatedTransactions, 1);
  assert.equal(stats.byType[1].total, 0);
});

test('pas d\'evolution sans reference le mois precedent', () => {
  const alone = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
  ], OCTOBER_23);
  assert.equal(alone.previousMonth.total, 0);
  assert.equal(alone.evolution, null);

  const compared = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-09-15T10:00:00+00:00'),
    payment('150.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
  ], OCTOBER_23);
  assert.equal(compared.previousMonth.from, '2026-09-01T00:00:00');
  assert.equal(compared.previousMonth.total, 100);
  assert.equal(compared.focusMonth.total, 150);
  assert.equal(compared.evolution, 0.5);
});

test('la projection est un prorata, et elle disparait le dernier jour du mois', () => {
  const rows = [payment('230.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00')];

  const running = financeRevenueStats(rows, OCTOBER_23);
  assert.equal(running.projection.elapsedDays, 23);
  assert.equal(running.projection.monthDays, 31);
  assert.equal(running.projection.value, (230 / 23) * 31);

  // Le 31, il n'y a plus rien a extrapoler.
  assert.equal(financeRevenueStats(rows, new Date(2026, 9, 31, 12)).projection, null);
  // Ni sur un mois qui n'a rien encaisse.
  assert.equal(financeRevenueStats([], OCTOBER_23).projection, null);
});

test('les bornes se classent sur l\'horodatage, pas sur la chaine', () => {
  // 00:30 a Tunis le 2 = 22:30 UTC le 1er : c'est le plus ancien des deux,
  // alors qu'il est le plus grand en comparaison lexicale.
  const earlier = '2026-10-02T00:30:00+02:00';
  const later = '2026-10-01T23:00:00+00:00';
  const stats = financeRevenueStats([
    payment('10.00', 'abonnement', 'reussi', later),
    payment('10.00', 'abonnement', 'reussi', earlier),
  ], OCTOBER_23);

  assert.equal(stats.firstPaidAt, earlier);
  assert.equal(stats.lastPaidAt, later);
});

test('les devises rencontrees sont remontees, pour que l\'ecran puisse le dire', () => {
  const single = financeRevenueStats([
    payment('10.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
  ], OCTOBER_23);
  assert.deepEqual(single.currencies, ['TND']);

  const mixed = financeRevenueStats([
    payment('10.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00', 'TND'),
    payment('10.00', 'scout_day', 'reussi', '2026-10-06T10:00:00+00:00', 'eur'),
  ], OCTOBER_23);
  assert.deepEqual(mixed.currencies, ['EUR', 'TND']);
});


test('le pas descend au jour tant que les encaissements tiennent dans deux mois', () => {
  const court = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-09-28T10:00:00+00:00'),
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
  ], OCTOBER_23);
  assert.equal(court.series.step, 'jour');
  // Les pas vides sont conserves : un mois entier, pas deux colonnes.
  assert.equal(court.series.points.length, 31);
  assert.equal(court.series.points.filter((point) => point.total > 0).length, 1);

  const long = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-08-05T10:00:00+00:00'),
    payment('100.00', 'abonnement', 'reussi', '2026-09-05T10:00:00+00:00'),
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
  ], OCTOBER_23);
  assert.equal(long.series.step, 'mois');
  assert.equal(long.series.points.length, 12);
  assert.equal(long.series.points.at(-1).total, 100);

  // Un mois en cours vide ne peut pas etre dessine au jour, quoi qu'il arrive.
  const absent = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-09-05T10:00:00+00:00'),
  ], OCTOBER_23);
  assert.equal(absent.series.step, 'mois');
});

test('le pas empile les deux types et porte leur somme', () => {
  const stats = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
    payment('40.00', 'scout_day', 'reussi', '2026-10-05T18:00:00+00:00'),
  ], OCTOBER_23);

  const fifth = stats.series.points[4];
  assert.equal(fifth.abonnement, 100);
  assert.equal(fifth.scoutDay, 40);
  assert.equal(fifth.total, 140);
  assert.equal(stats.series.max, 140);
});

test('le cumul est monotone, decompose, et le prolongement part du dernier point reel', () => {
  const stats = financeRevenueStats([
    payment('100.00', 'abonnement', 'reussi', '2026-10-05T10:00:00+00:00'),
    payment('130.00', 'scout_day', 'reussi', '2026-10-12T10:00:00+00:00'),
  ], OCTOBER_23);

  assert.equal(stats.cumulative.length, 23);
  assert.equal(stats.cumulative[0].value, 0);
  assert.equal(stats.cumulative[4].value, 100);
  assert.equal(stats.cumulative.at(-1).value, 230);
  assert.equal(stats.cumulative.at(-1).abonnement, 100);
  assert.equal(stats.cumulative.at(-1).scoutDay, 130);
  for (let index = 1; index < stats.cumulative.length; index += 1) {
    assert.ok(stats.cumulative[index].value >= stats.cumulative[index - 1].value);
  }

  // La jonction : meme jour, meme valeur. Une rupture se lirait comme un
  // encaissement qui n'a pas eu lieu.
  const start = stats.projectedCumulative[0];
  assert.equal(start.day, 23);
  assert.equal(start.value, stats.cumulative.at(-1).value);
  assert.equal(stats.projectedCumulative.at(-1).day, 31);
  assert.equal(stats.projectedCumulative.at(-1).value, stats.projection.value);
});

test("un debut de pas se lit en heure locale, pas en UTC", () => {
  // `new Date("2026-10-23")` vaut minuit UTC : relu a Los Angeles il tombe le
  // 22. C'est ce decalage qui renommait les colonnes du graphique.
  const tz = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const stats = financeRevenueStats([
      payment('100.00', 'abonnement', 'reussi', '2026-10-23T05:00:00-07:00'),
    ], new Date(2026, 9, 23, 12));
    const labelled = stats.series.points.map((point) => new Date(point.start).getDate());
    assert.deepEqual(labelled.slice(0, 3), [1, 2, 3]);
    assert.equal(new Date(stats.focusMonth.from).getDate(), 1);
  } finally {
    process.env.TZ = tz;
  }
});


/** Trois mois d'encaissements : aout, septembre, octobre. */
const TROIS_MOIS = [
  payment('100.00', 'abonnement', 'reussi', '2026-08-10T10:00:00+00:00'),
  payment('200.00', 'scout_day', 'reussi', '2026-09-04T10:00:00+00:00'),
  payment('300.00', 'abonnement', 'reussi', '2026-09-18T10:00:00+00:00'),
  payment('400.00', 'scout_day', 'reussi', '2026-10-07T10:00:00+00:00'),
];

test("une valeur de mois venue de l'URL est bornee avant d'etre crue", () => {
  assert.equal(parseMonth(null, OCTOBER_23), null);
  assert.equal(parseMonth('', OCTOBER_23), null);
  assert.equal(parseMonth('octobre', OCTOBER_23), null);
  assert.equal(parseMonth('2026-13', OCTOBER_23), null);
  assert.equal(parseMonth('2026-00', OCTOBER_23), null);
  assert.equal(parseMonth('2026-9', OCTOBER_23), null);
  // Un mois futur : le prorata y diviserait par des jours qui ne sont pas
  // passes, et l'ecran annoncerait une projection sur un mois vide.
  assert.equal(parseMonth('2026-11', OCTOBER_23), null);
  assert.equal(parseMonth('2027-01', OCTOBER_23), null);

  const septembre = parseMonth('2026-09', OCTOBER_23);
  assert.equal(septembre.getFullYear(), 2026);
  assert.equal(septembre.getMonth(), 8);
  assert.equal(septembre.getDate(), 1);
  // Le mois courant lui-meme est un choix legitime.
  assert.ok(parseMonth('2026-10', OCTOBER_23));
});

test('un mois choisi cadre le total, la repartition et la fenetre annoncee', () => {
  const tous = financeRevenueStats(TROIS_MOIS, OCTOBER_23);
  assert.equal(tous.scope, 'tous');
  assert.equal(tous.total, 1000);

  const septembre = financeRevenueStats(TROIS_MOIS, OCTOBER_23, '2026-09');
  assert.equal(septembre.scope, 'mois');
  assert.equal(septembre.focusMonth.from, '2026-09-01T00:00:00');
  assert.equal(septembre.focusMonth.total, 500);
  // Les trois suivent la meme portee : un total filtre a cote d'une
  // repartition qui ne l'est pas donnerait deux lectures du meme mois.
  assert.equal(septembre.total, 500);
  assert.equal(septembre.transactions, 2);
  assert.equal(septembre.byType[0].total, 300);
  assert.equal(septembre.byType[1].total, 200);
  assert.equal(septembre.firstPaidAt, '2026-09-04T10:00:00+00:00');
  assert.equal(septembre.lastPaidAt, '2026-09-18T10:00:00+00:00');
  // L'evolution se mesure sur le mois d'avant CELUI QU'ON REGARDE.
  assert.equal(septembre.previousMonth.total, 100);
  assert.equal(septembre.evolution, 4);
});

test('la liste des mois reste complete, quel que soit le mois choisi', () => {
  const septembre = financeRevenueStats(TROIS_MOIS, OCTOBER_23, '2026-09');
  assert.deepEqual(
    septembre.months.map((month) => month.value),
    ['2026-10', '2026-09', '2026-08'],
  );
  assert.equal(septembre.months[0].start, '2026-10-01T00:00:00');
});

test("un mois clos est entierement ecoule, et il n'est pas prolonge", () => {
  const septembre = financeRevenueStats(TROIS_MOIS, OCTOBER_23, '2026-09');
  assert.equal(septembre.isCurrentMonth, false);
  assert.equal(septembre.monthDays, 30);
  assert.equal(septembre.elapsedDays, 30);
  assert.equal(septembre.cumulative.length, 30);
  assert.equal(septembre.cumulative.at(-1).value, 500);
  assert.equal(septembre.projection, null);
  assert.deepEqual(septembre.projectedCumulative, []);

  // Le mois courant, lui, garde sa projection.
  const octobre = financeRevenueStats(TROIS_MOIS, OCTOBER_23, '2026-10');
  assert.equal(octobre.isCurrentMonth, true);
  assert.equal(octobre.elapsedDays, 23);
  assert.ok(octobre.projection);
});

test('un mois choisi se dessine toujours au jour, meme avec un long historique', () => {
  // Sans filtre, trois mois d'historique font passer la serie au pas mensuel.
  assert.equal(financeRevenueStats(TROIS_MOIS, OCTOBER_23).series.step, 'mois');
  const septembre = financeRevenueStats(TROIS_MOIS, OCTOBER_23, '2026-09');
  assert.equal(septembre.series.step, 'jour');
  assert.equal(septembre.series.points.length, 30);
  assert.equal(septembre.series.points[3].scoutDay, 200);
  assert.equal(septembre.series.points[17].abonnement, 300);
});
