/**
 * Les axes d'evaluation — six depuis la migration mobile 0091, quatre avant.
 *
 * On transpile le vrai `lib/evaluation-axes.ts` et on l'execute : recopier
 * `axesOf()` ici ne mesurerait que la copie. Les icones `lucide-react` sont
 * remplacees par un objet vide — ce test porte sur la resolution des notes,
 * pas sur le rendu.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');

function load() {
  const source = fs.readFileSync(path.join(root, 'lib/evaluation-axes.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    // Chaque icone demandee rend un marqueur : le module n'en fait rien ici.
    require: (name) =>
      name === 'lucide-react'
        ? new Proxy({}, { get: (_, key) => `icon:${String(key)}` })
        : require(name),
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(js, sandbox);
  return sandbox.module.exports;
}

const {
  axesOf,
  averageOf,
  EVALUATION_AXES,
  LEGACY_EVALUATION_AXES,
  EVALUATION_SCORE_COLUMNS,
} = load();

const SIX = { speed_score: 80, finishing_score: 70, accuracy_score: 60, passing_score: 90, defending_score: 50, cognitive_score: 40 };
const FOUR = { technical_score: 80, physical_score: 70, tactical_score: 60, mental_score: 50 };

test('la liste de colonnes du select suit les axes declares', () => {
  // Le controle que le systeme de types ne peut pas faire : supabase-js analyse
  // la chaine du `select` au niveau des types, donc elle doit etre litterale.
  const derived = [...EVALUATION_AXES, ...LEGACY_EVALUATION_AXES]
    .map((axis) => `${axis.key}_score`)
    .join(', ');
  assert.equal(EVALUATION_SCORE_COLUMNS, derived);
});

test('une evaluation de 0091 rend ses six axes', () => {
  const axes = axesOf(SIX);
  assert.equal(axes.length, 6);
  assert.deepEqual(axes.map((a) => a.spec.key), ['speed', 'finishing', 'accuracy', 'passing', 'defending', 'cognitive']);
  assert.deepEqual(axes.map((a) => a.value), [80, 70, 60, 90, 50, 40]);
});

test('une evaluation anterieure rend ses quatre axes, jamais convertis', () => {
  const axes = axesOf(FOUR);
  assert.equal(axes.length, 4);
  assert.deepEqual(axes.map((a) => a.spec.key), ['technical', 'physical', 'tactical', 'mental']);
});

test('une ligne a six axes ignore les colonnes de 0030 restees nulles', () => {
  // ⚠️ Ce test NE rattrape PAS a lui seul le bug d'origine : celui-ci etait au
  // point d'appel, qui lisait `Number(row.technical_score)` sans passer par
  // `axesOf()`. Verifie par mutation — inverser l'ordre des deux jeux ne le
  // fait pas echouer, parce que `axesOf` exige un jeu complet et se trouve
  // donc insensible a l'ordre. Ce qui a des dents contre le mecanisme du bug
  // (lire `null` comme 0) ce sont les trois tests suivants : muter
  // `row[...]` en `row[...] ?? 0` en fait tomber trois.
  const row = { ...SIX, technical_score: null, physical_score: null, tactical_score: null, mental_score: null };
  const axes = axesOf(row);
  assert.equal(axes.length, 6);
  assert.ok(!axes.some((a) => a.spec.key === 'technical'));
  assert.ok(!axes.some((a) => a.value === 0), 'aucune note ne doit valoir 0 ici');
});

test('un jeu incomplet ne rend rien plutot qu une grille amputee', () => {
  const partial = { speed_score: 80, finishing_score: 70 };
  assert.deepEqual(axesOf(partial), []);
  assert.deepEqual(axesOf({}), []);
  assert.deepEqual(axesOf(null), []);
});

test('la moyenne est equiponderee, sur six comme sur quatre', () => {
  assert.equal(averageOf(axesOf(SIX)), (80 + 70 + 60 + 90 + 50 + 40) / 6);
  assert.equal(averageOf(axesOf(FOUR)), (80 + 70 + 60 + 50) / 4);
  assert.equal(averageOf([]), null);
});
