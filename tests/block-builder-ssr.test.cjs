// Ce que ce fichier garde : le compositeur de blocs rend **le meme HTML** deux
// fois de suite.
//
// ⚠️ Pourquoi ce test existe. dnd-kit derive le `aria-describedby` de chaque
// poignee d'un compteur **de module** : `useUniqueId(prefix, value)` incremente
// `ids[prefix]` a chaque appel quand aucune valeur n'est fournie. Ce compteur
// repart de zero dans le navigateur mais pas sur le serveur, si bien que le
// HTML rendu et le HTML hydrate portaient `DndDescribedBy-0` et
// `DndDescribedBy-1` — React signalait une divergence d'hydratation a chaque
// ouverture de l'ecran, et rien dans le build ne le voyait.
//
// Rendre deux fois reproduit exactement cette divergence : sans `id` sur le
// `DndContext`, le second rendu porte un numero de plus.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const fr = require('../messages/admin/fr.json');

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
  if (name === 'next/navigation') return { usePathname: () => '/admin', useRouter: () => ({ push() {}, refresh() {} }) };
  return load.call(this, name, ...args);
};

const { AdminI18nProvider } = require('../lib/i18n/admin-client.tsx');
const { EmailBlockBuilder } = require('../components/admin/email-block-builder.tsx');
const { DEFAULT_BLOCKS } = require('../lib/email/blocks.ts');

const renderOnce = () =>
  renderToStaticMarkup(
    React.createElement(
      AdminI18nProvider,
      { locale: 'fr', dict: fr },
      React.createElement(EmailBlockBuilder, {
        initial: [{ id: 'b1', type: 'text', text: { fr: 'bonjour' } }, ...DEFAULT_BLOCKS],
        locale: 'fr',
        locales: ['fr', 'en', 'ar'],
        onPickLocale: () => {},
        action: async () => ({ ok: true, message: '' }),
        disabled: false,
      }),
    ),
  );

test('deux rendus successifs produisent le meme HTML (pas de divergence d\'hydratation)', () => {
  const first = renderOnce();
  const second = renderOnce();

  // Temoin : le rendu doit vraiment contenir les poignees, sinon le test
  // comparerait deux chaines vides et passerait pour rien.
  assert.match(first, /aria-roledescription="sortable"/);
  const ids = [...first.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 2, `poignees attendues, trouvees : ${ids.length}`);

  assert.equal(second, first, 'le second rendu differe du premier');
});
