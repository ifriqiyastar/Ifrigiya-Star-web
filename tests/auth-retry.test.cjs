// La reprise de la garde d'administration quand le lien tombe.
//
// Ce que ce fichier garde : une coupure reseau **d'une requete** ne doit pas
// remonter jusqu'a l'ecran. Observe en developpement — `TypeError: fetch
// failed` sur `admin_guard`, alors que le projet repondait en 100 ms la
// seconde d'apres — et deja paye une fois : avant la distinction
// transport/SQL, une coupure d'une seconde deconnectait l'administrateur en
// lui disant que son compte n'existait pas.
//
// ⚠️ CE QUI FAIT ECHOUER CE FICHIER SI LE DEFAUT REVIENT : retirer la reprise
// de `onceMore()` (rendre le premier resultat tel quel) — le premier cas
// tombe. L'etendre aux erreurs SQL — le troisieme tombe, et c'est lui qui
// garde le cout : rejouer un `42501` paie un aller-retour pour la meme
// reponse. Lui donner deux reprises au lieu d'une — le deuxieme tombe.
//
// Ce qu'il ne couvre PAS : que `requireAdmin()` et `loadAdminGuard()`
// passent bien par cette fonction. C'est verifie a la lecture, et le build
// l'impose puisqu'elles n'appellent plus `supabase` directement.
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
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    module._compile(outputText, filename);
  };
}
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'server-only') return {};
  if (name === 'next/headers') return {
    headers: async () => new Headers(),
    cookies: async () => ({ getAll: () => [], get: () => undefined }),
  };
  if (name === 'next/navigation') return {
    redirect: (to) => { throw new Error(`redirect:${to}`); },
    notFound: () => {},
  };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  return load.call(this, name, ...args);
};

const { onceMoreForTest } = require('../lib/auth.ts');

// Une panne de transport se reconnait a l'absence de `code` : `supabase-js`
// remonte l'erreur d'`undici` telle quelle.
const TRANSPORT = { message: 'fetch failed' };
const SQL = { code: '42501', message: 'permission denied for function admin_guard' };

test('une coupure d\'une requete est rejouee, une coupure durable ne l\'est pas', async () => {
  let appels = 0;
  const unBlip = () => {
    appels += 1;
    return Promise.resolve(appels === 1 ? { data: null, error: TRANSPORT } : { data: 'ok', error: null });
  };
  const repris = await onceMoreForTest(unBlip);
  assert.equal(appels, 2, 'la lecture n\'a pas ete rejouee');
  assert.deepEqual(repris, { data: 'ok', error: null }, 'le second essai devait rendre la vraie reponse');

  // ⚠️ Une seule reprise : au-dela, l'ecran attend sans rien dire, et la
  // page d'erreur avec son bouton « Reessayer » fait mieux l'affaire.
  appels = 0;
  const coupure = () => {
    appels += 1;
    return Promise.resolve({ data: null, error: TRANSPORT });
  };
  const perdu = await onceMoreForTest(coupure);
  assert.equal(appels, 2, 'une seule reprise, pas plus');
  assert.equal(perdu.error, TRANSPORT, 'l\'erreur doit remonter telle quelle');
});

test('une erreur SQL ne se rejoue pas, et le chemin heureux ne paie rien', async () => {
  // Rejouer un refus de Postgres rend le meme refus, en payant un
  // aller-retour de plus sur une base qui repond parfaitement.
  let appels = 0;
  const refus = () => {
    appels += 1;
    return Promise.resolve({ data: null, error: SQL });
  };
  const rendu = await onceMoreForTest(refus);
  assert.equal(appels, 1, 'un 42501 a ete rejoue');
  assert.equal(rendu.error.code, '42501');

  // ⚠️ Le TEMOIN du cout : sans lui, une fonction qui lirait toujours deux
  // fois passerait les assertions ci-dessus sans rien prouver.
  appels = 0;
  await onceMoreForTest(() => {
    appels += 1;
    return Promise.resolve({ data: 'ok', error: null });
  });
  assert.equal(appels, 1, 'le chemin heureux paie un aller-retour de plus');
});
