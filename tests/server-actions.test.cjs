// Ce que ce fichier garde : un module « use server » n'exporte que des
// fonctions asynchrones.
//
// ⚠️ Pourquoi un test plutot que le build. Next verifie cette regle **a
// l'evaluation du module**, pas a la compilation. Tous les ecrans
// d'administration sont dynamiques et derriere `requireAdmin()`, donc aucun
// n'est rendu pendant `next build` : un `export const` glisse dans un fichier
// d'actions passe le build sans un mot et explose a la premiere ouverture de
// l'ecran, en production comme en developpement. C'est arrive une fois
// (`TEMPLATE_LOCALES` dans `lib/actions/email-template.ts`).
//
// Un `export type` / `export interface` ne compte pas : TypeScript l'efface.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function serverActionFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', '.next', '.git'].includes(entry.name) ? [] : serverActionFiles(full);
    }
    if (!/\.tsx?$/.test(entry.name)) return [];
    const source = fs.readFileSync(full, 'utf8');
    // La directive doit etre la premiere instruction du fichier.
    return /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(source)
      ? [{ file: path.relative(root, full), source }]
      : [];
  });
}

/** Les exports de valeur du fichier, avec ce qu'ils exportent vraiment. */
function valueExports(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
  const found = [];
  for (const statement of tree.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
    const exported = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;

    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) continue;

    if (ts.isFunctionDeclaration(statement)) {
      const isAsync = modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      found.push({ name: statement.name?.text ?? '(anonyme)', kind: isAsync ? 'async function' : 'function' });
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        found.push({ name: declaration.name.getText(tree), kind: 'const' });
      }
      continue;
    }
    found.push({ name: statement.getText(tree).slice(0, 40), kind: ts.SyntaxKind[statement.kind] });
  }
  return found;
}

test('un module "use server" n\'exporte que des fonctions asynchrones', () => {
  const files = serverActionFiles(root);
  // Temoin : si la detection casse, le test passerait en n'examinant rien.
  assert.ok(files.length >= 5, `Trop peu de fichiers « use server » trouves : ${files.length}`);

  const offenders = [];
  for (const { file, source } of files) {
    for (const item of valueExports(file, source)) {
      if (item.kind !== 'async function') offenders.push(`${file} → export ${item.kind} ${item.name}`);
    }
  }
  assert.deepEqual(offenders, [], `Exports interdits dans un fichier « use server » :\n${offenders.join('\n')}`);
});
