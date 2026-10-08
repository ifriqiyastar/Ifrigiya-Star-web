/**
 * `signStorageUrls` — la signature groupee dont dependent les vignettes de
 * `/admin/utilisateurs` et, depuis cette passe, celles de
 * `/admin/moderation/publications`.
 *
 * On transpile le vrai module et on l'execute avec un faux client Supabase :
 * ce qui est mesure ici, c'est la selection de ce qui doit etre signe, le
 * cache (par bucket) et le comportement en cas d'echec — pas Storage.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const PROJECT = 'https://tqeilnfndqipoklnqyca.supabase.co';

function transpile(file, sandbox) {
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, sandbox);
  return sandbox.module.exports;
}

const env = { NEXT_PUBLIC_SUPABASE_URL: PROJECT, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' };

function load() {
  const configBox = { module: { exports: {} }, exports: {}, process: { env } };
  configBox.module.exports = configBox.exports;
  const config = transpile('lib/supabase/config.ts', configBox);

  const box = {
    module: { exports: {} },
    exports: {},
    process: { env },
    console,
    Date,
    Map,
    require: (name) => {
      if (name === '@/lib/supabase/config') return config;
      throw new Error('import inattendu : ' + name);
    },
  };
  box.module.exports = box.exports;
  return transpile('lib/queries/signed-media.ts', box);
}

const { signStorageUrls } = load();

/** Un client qui note ce qu'on lui demande de signer. */
function fakeClient({ fail = false } = {}) {
  const calls = [];
  return {
    calls,
    storage: {
      from: (bucket) => ({
        createSignedUrls: async (paths) => {
          calls.push({ bucket, paths });
          if (fail) return { data: null, error: { message: 'nope' } };
          return {
            data: paths.map((p) => ({ path: p, signedUrl: `${PROJECT}/signed/${bucket}/${p}?token=t` })),
            error: null,
          };
        },
      }),
    },
  };
}

test('la Map est indexee par la valeur STOCKEE, pas par le chemin', async () => {
  // L'appelant ne connait que ce que porte la colonne : une URL publique
  // complete cote mobile, un chemin nu ailleurs. Indexer par chemin
  // l'obligerait a refaire la normalisation pour retrouver sa propre ligne.
  const stored = `${PROJECT}/storage/v1/object/public/post-media/uid/photo-1.png`;
  const client = fakeClient();
  const map = await signStorageUrls(client, 'post-media', [stored]);
  assert.deepEqual(client.calls[0], { bucket: 'post-media', paths: ['uid/photo-1.png'] });
  assert.match(map.get(stored), /\/signed\/post-media\/uid\/photo-1\.png/);
});

test('rien a signer : adresse externe, sentinelle, valeur vide', async () => {
  const client = fakeClient();
  const map = await signStorageUrls(client, 'post-media', [
    'https://img.youtube.com/vi/abc/0.jpg',
    'dummy/photo/url.jpg',
    null,
    undefined,
    '   ',
  ]);
  // Aucune demande ne part : signer une adresse externe est impossible, et la
  // sentinelle ne peut rendre qu'un 404. L'appelant retombe sur storageUrl().
  assert.equal(client.calls.length, 0);
  assert.equal(map.size, 0);
});

test('le cache evite une seconde signature pour le meme objet', async () => {
  // `AutoRefresh` rejoue la page toutes les 30 s : sans cache, chaque rendu
  // changerait le jeton et le navigateur retelechargerait toutes les images.
  const first = fakeClient();
  const a = await signStorageUrls(first, 'post-media', ['uid/cache-me.png']);
  const second = fakeClient();
  const b = await signStorageUrls(second, 'post-media', ['uid/cache-me.png']);
  assert.equal(second.calls.length, 0);
  assert.equal(b.get('uid/cache-me.png'), a.get('uid/cache-me.png'));
});

test('le cache est par bucket : deux buckets, un meme chemin', async () => {
  // ⚠️ Le temoin de la mutation : une cle de cache qui oublie le bucket rend
  // l'URL de `post-media` pour une image d'`avatars`, donc une image qui ne
  // repond pas — et le defaut ne se voit qu'une fois en ligne.
  const shared = 'uid/portrait.png';
  await signStorageUrls(fakeClient(), 'post-media', [shared]);
  const client = fakeClient();
  const map = await signStorageUrls(client, 'avatars', [shared]);
  assert.equal(client.calls.length, 1, 'le second bucket doit etre signe pour lui-meme');
  assert.match(map.get(shared), /\/signed\/avatars\//);
});

test('une signature en echec coute la rapidite, jamais l\'image', async () => {
  const map = await signStorageUrls(fakeClient({ fail: true }), 'post-media', ['uid/boom.png']);
  // Map vide, pas d'exception : l'appelant repasse par /admin/documents.
  assert.equal(map.size, 0);
});
