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
const en = require('../messages/admin/en.json');
const request = { headers: new Headers(), cookies: {}, locale: 'fr' };

// Load application TypeScript with the installed compiler. Only request APIs are
// substituted; translation helpers, React, forms and Base UI run their real code.
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return resolveFilename.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
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
    headers: async () => request.headers,
    cookies: async () => ({ get: (key) => request.cookies[key] ? { value: request.cookies[key] } : undefined }),
  };
  if (name === 'next/root-params') return { locale: async () => request.locale };
  if (name === 'next/navigation') return {
    usePathname: () => `/${request.locale}/admin`,
    useRouter: () => ({ push() {}, refresh() {} }),
  };
  return load.call(this, name, ...args);
};

const { makeAdminI18n } = require('../lib/i18n/admin-shared.ts');
const { getAdminI18n, getRequestAdminLocale } = require('../lib/i18n/admin.ts');
const { AdminI18nProvider } = require('../lib/i18n/admin-client.tsx');
const { ProfileCoreForm } = require('../components/admin/forms/profile-core-form.tsx');
const { PlayerProfileForm } = require('../components/admin/forms/player-profile-form.tsx');
const { PageHeader } = require('../components/admin/page-header.tsx');
const { removalConfirmation } = require('../lib/moderation-targets.ts');
const { ADMIN_LOCALE_HEADER, LOCALE_COOKIE } = require('../lib/i18n/config.ts');

function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => typeof child === 'string'
    ? [[prefix + key, child]] : leaves(child, `${prefix}${key}.`));
}

test('French and English dictionaries have matching keys and interpolation placeholders', () => {
  const french = new Map(leaves(fr));
  const english = new Map(leaves(en));
  assert.deepEqual([...english.keys()].sort(), [...french.keys()].sort());
  for (const [key, value] of french) {
    const translated = english.get(key);
    assert.ok(translated.trim(), `Empty translation: ${key}`);
    const tokens = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(tokens(translated), tokens(value), `Placeholder mismatch: ${key}`);
  }
});

test('screen copy, counts, dates and internal routes follow the chosen language', async () => {
  request.locale = 'en';
  const english = await getAdminI18n();
  assert.equal(english.t('Annuaire des comptes & utilisateurs'), 'Account & user directory');
  assert.equal(english.t('{0} campagnes enregistrees', { 0: 2 }), '2 recorded campaigns');
  assert.match(english.format.formatMonth('2026-09-11T12:00:00Z'), /September/);
  assert.equal(english.path('/admin/utilisateurs?page=2&role=player'), '/en/admin/utilisateurs?page=2&role=player');
  assert.equal(english.path('/en/admin/finances?vue=offres'), '/en/admin/finances?vue=offres');
  const french = makeAdminI18n('fr', fr);
  assert.equal(french.path('/en/admin/finances?vue=offres'), '/admin/finances?vue=offres');
  assert.equal(french.t('Enregistrer'), 'Enregistrer');
  assert.match(french.format.formatMonth('2026-09-11T12:00:00Z'), /septembre/);
});

test('action locale follows the resolved route before cookie and browser preferences', async () => {
  request.cookies = { [LOCALE_COOKIE]: 'fr' };
  request.headers = new Headers({ [ADMIN_LOCALE_HEADER]: 'en', 'accept-language': 'fr' });
  assert.equal(await getRequestAdminLocale(), 'en');
  request.headers = new Headers({ [ADMIN_LOCALE_HEADER]: 'fr', 'accept-language': 'en' });
  request.cookies = { [LOCALE_COOKIE]: 'en' };
  assert.equal(await getRequestAdminLocale(), 'fr');
  request.headers = new Headers({ 'accept-language': 'en-GB,en;q=0.9' });
  request.cookies = {};
  assert.equal(await getRequestAdminLocale(), 'en');
  request.cookies = { [LOCALE_COOKIE]: 'ar' };
  assert.equal(await getRequestAdminLocale(), 'fr');
});

function renderIn(locale, component) {
  request.locale = locale;
  return renderToStaticMarkup(React.createElement(AdminI18nProvider, {
    locale, dict: locale === 'en' ? en : fr,
  }, component));
}

test('account form renders translated labels and preserves submitted role/language values', () => {
  const form = React.createElement(ProfileCoreForm, {
    values: { full_name: 'Test Person', email: 'test@example.invalid', phone: '', locale: 'en', role: 'player' },
    action: async () => ({ ok: true, message: '' }), canChangeRole: true,
  });
  const english = renderIn('en', form);
  assert.match(english, /Full name/);
  assert.match(english, /Email address/);
  assert.match(english, />Save</);
  assert.match(english, /value="player"[^>]*>Player</);
  assert.match(english, /value="fr"[^>]*>French</);
  assert.doesNotMatch(english, /Nom complet|Enregistrer|Adresse email/);
  const french = renderIn('fr', form);
  assert.match(french, /Nom complet/);
  assert.match(french, />Enregistrer</);
});

test('sports form translates positions without changing stored football values', () => {
  const form = React.createElement(PlayerProfileForm, {
    values: {
      first_name: '', last_name: '', birth_date: '', nationality: '', country: '', city: '',
      main_position: 'Défenseur central', secondary_position: null, foot_preference: 'droit',
      current_club: '', is_free_agent: false, height_cm: null, weight_kg: null, level: 'amateur', about: '',
    }, action: async () => ({ ok: true, message: '' }),
  });
  const html = renderIn('en', form);
  assert.match(html, /value="Défenseur central"[^>]*>Centre-back</);
  assert.match(html, /value="Defenseur central"[^>]*>Centre-back</);
  assert.match(html, /value="droit"[^>]*>Right</);
  assert.match(html, /Primary position/);
});

test('server headers and removal confirmations use translated copy', async () => {
  request.locale = 'en';
  const header = await PageHeader({ title: 'Users', breadcrumb: [{ label: 'Accounts' }] });
  const html = renderToStaticMarkup(header);
  assert.match(html, /aria-label="Breadcrumb"/);
  const english = makeAdminI18n('en', en);
  const confirmation = removalConfirmation('supprime', 'video', english);
  assert.equal(confirmation.actionLabel, 'Delete video');
  assert.match(confirmation.description, /IRREVERSIBLE/);
});

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

test('client component imports never pull in request-only translation modules', () => {
  const files = ['app', 'components', 'lib'].flatMap((dir) => filesUnder(path.join(root, dir)))
    .filter((file) => /\.tsx?$/.test(file));
  const fileSet = new Set(files);
  const visited = new Set();
  function walk(file, chain) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    if (/^["']use server["']/.test(source)) return; // Next.js creates a Server Action reference.
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const node of sf.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || node.isTypeOnly || node.importClause?.isTypeOnly) continue;
      const names = node.importClause?.namedBindings || node.exportClause;
      if (names?.elements?.length && names.elements.every((element) => element.isTypeOnly)) continue;
      const name = node.moduleSpecifier.text;
      assert.ok(!['server-only', 'next/headers', 'next/root-params'].includes(name), `${chain.join(' -> ')} -> ${name}`);
      if (!name.startsWith('@/') && !name.startsWith('.')) continue;
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      const target = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find((candidate) => fileSet.has(candidate));
      if (target) walk(target, [...chain, path.relative(root, target)]);
    }
  }
  for (const file of files) {
    if (/^["']use client["']/.test(fs.readFileSync(file, 'utf8'))) walk(file, [path.relative(root, file)]);
  }
});
