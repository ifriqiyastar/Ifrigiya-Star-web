/**
 * `likeTerm` / `orLikeTerm` / `orSearchClause` — l'echappement de TOUTE
 * recherche texte du back-office (annuaire, blog, moderation, campagnes,
 * Scout Days, files de validation).
 *
 * On transpile le vrai `lib/queries/search-term.ts` et on l'execute : recopier
 * les fonctions ici ne mesurerait que la copie.
 *
 * CE QUE CE FICHIER GARDE, et la cassure deliberee qui le fait echouer :
 *
 *  1. retirer le `.replace(/\\/g, "\\\\")` de `likeTerm` → « le `\` part en
 *     premier » casse, et les deux premiers tests tombent ;
 *  2. retirer le second echappement d'`orLikeTerm` → « PostgREST deshabille un
 *     niveau » casse : le motif ressort avec un seul `\`, mesure comme rendant
 *     la table entiere sur le projet reel ;
 *  3. revenir au `replace(/[%,()]/g, " ")` d'avant → « on echappe, on
 *     n'efface pas » casse sur `%` comme sur `_` ;
 *  4. retirer les guillemets d'`orLikeTerm` → « la virgule ne coupe pas la
 *     clause » casse.
 *
 * CE QU'IL NE COUVRE PAS : que PostgREST interprete bien ces motifs. Cela se
 * verifie contre le projet (la mesure est citee dans le module), pas ici — un
 * test hors ligne ne peut que garder la chaine emise.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'lib/queries/search-term.ts'),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { module: { exports: {} }, exports: {} };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(js, sandbox);
  return sandbox.module.exports;
}

const { likeTerm, orLikeTerm, orSearchClause, USER_SEARCH_COLUMNS } = load();

test('un terme ordinaire est juste entoure de %', () => {
  assert.equal(likeTerm('Zerriaa'), '%Zerriaa%');
});

test('les jokers de Postgres sont echappes, pas effaces', () => {
  // L'ancienne forme remplacait le % par une espace : « 100% » devenait
  // « 100 » et ramenait tout ce qui commence par 100.
  assert.equal(likeTerm('100%'), '%100\\%%');
  // Et ne traitait pas du tout le `_`, joker « un caractere quelconque » :
  // chercher Jean_Pierre ramenait aussi JeanXPierre.
  assert.equal(likeTerm('Jean_Pierre'), '%Jean\\_Pierre%');
});

test('le \\ part en premier, sinon il echappe les echappements ajoutes apres', () => {
  // Si le `\` etait traite en dernier, le `\` ajoute devant le `%` serait
  // lui-meme redouble et le motif chercherait un antislash litteral.
  assert.equal(likeTerm('a\\b'), '%a\\\\b%');
  assert.equal(likeTerm('\\%'), '%\\\\\\%%');
});

test("dans un or=(...), le motif est entre guillemets et double-echappe", () => {
  // PostgREST deshabille un niveau de \ en sortant des guillemets : le motif
  // doit donc partir avec deux \ pour qu'il en reste un.
  assert.equal(orLikeTerm('100%'), '"%100\\\\%%"');
  assert.equal(orLikeTerm('Zerriaa'), '"%Zerriaa%"');
});

test('la virgule et les parentheses ne coupent pas la clause', () => {
  // Elles sont reservees par or=(...) ; les guillemets les neutralisent, ce
  // qui permet de les CHERCHER au lieu de les effacer du terme.
  const clause = orSearchClause(['full_name'], 'Zerriaa, Rayen (Wii)');
  assert.equal(clause, 'full_name.ilike."%Zerriaa, Rayen (Wii)%"');
});

test('un guillemet dans le terme est echappe, pas ferme', () => {
  assert.equal(orLikeTerm('l"a'), '"%l\\"a%"');
});

test('chaque colonne recoit le meme terme, separees par une virgule', () => {
  assert.equal(
    orSearchClause(USER_SEARCH_COLUMNS, 'ali'),
    'full_name.ilike."%ali%",email.ilike."%ali%",phone.ilike."%ali%"',
  );
});
