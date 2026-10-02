/**
 * `storagePathOf` / `storageUrl` — la normalisation dont depend l'affichage de
 * TOUTE image du back-office depuis que les buckets de medias sont prives.
 *
 * On transpile le vrai `lib/supabase/config.ts` et on l'execute : recopier la
 * fonction ici ne mesurerait que la copie.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const PROJECT = 'https://tqeilnfndqipoklnqyca.supabase.co';

function load() {
  const source = fs.readFileSync(path.join(root, 'lib/supabase/config.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: PROJECT, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' } },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(js, sandbox);
  return sandbox.module.exports;
}

const { storagePathOf, storageUrl, publicStorageUrl } = load();

test('une URL publique complete redevient un chemin', () => {
  // La forme reellement stockee par l'app mobile dans profile_photo_url.
  const stored = `${PROJECT}/storage/v1/object/public/avatars/386ad8dc-0000-4000-8000-43fc84273630/avatar-1758000000000.png`;
  assert.equal(
    storagePathOf('avatars', stored),
    '386ad8dc-0000-4000-8000-43fc84273630/avatar-1758000000000.png',
  );
});

test('une URL signee perd son jeton — on resigne, on ne rejoue pas', () => {
  const signed = `${PROJECT}/storage/v1/object/sign/post-media/uid/clip.mp4?token=eyJhbGciOi.expire`;
  assert.equal(storagePathOf('post-media', signed), 'uid/clip.mp4');
});

test('un chemin nu passe tel quel', () => {
  assert.equal(storagePathOf('post-media', 'uid/photo.jpg'), 'uid/photo.jpg');
});

test('les segments encodes sont decodes', () => {
  const stored = `${PROJECT}/storage/v1/object/public/avatars/uid/mon%20avatar.png`;
  assert.equal(storagePathOf('avatars', stored), 'uid/mon avatar.png');
});

test("la sentinelle historique n'est pas un objet", () => {
  // Les lignes anterieures au vrai televersement portent encore ce chemin ;
  // le signer ne peut que rendre 404. Meme regle que le `like 'http%'` des
  // cinq fonctions SQL cote mobile.
  assert.equal(storagePathOf('avatars', 'dummy/photo/url.jpg'), null);
  assert.equal(storageUrl('avatars', 'dummy/photo/url.jpg'), null);
});

test('une adresse externe est conservee, pas avalee', () => {
  // Une vignette YouTube ne se signe pas : la rendre `null` effacerait une
  // image parfaitement valide.
  const youtube = 'https://i.ytimg.com/vi/abc123/hqdefault.jpg';
  assert.equal(storagePathOf('player-videos', youtube), null);
  assert.equal(storageUrl('player-videos', youtube), youtube);
});

test('le vide reste vide', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.equal(storagePathOf('avatars', value), null);
    assert.equal(storageUrl('avatars', value), null);
  }
});

test('storageUrl passe par la route qui signe, jamais par /object/public', () => {
  const stored = `${PROJECT}/storage/v1/object/public/avatars/uid/a.png`;
  const url = storageUrl('avatars', stored);
  assert.ok(url.startsWith('/admin/documents?'), url);
  assert.ok(url.includes('bucket=avatars'), url);
  assert.ok(url.includes(encodeURIComponent('uid/a.png')), url);
  assert.ok(!url.includes('/object/public/'), 'une URL publique ne doit plus sortir d ici');
});

test("TEMOIN : publicStorageUrl construit bien ce qu'on a cesse d'utiliser", () => {
  // Sans ce temoin, un `storageUrl` qui rendrait toujours null passerait les
  // tests ci-dessus pour la mauvaise raison.
  assert.equal(
    publicStorageUrl('blog-media', 'cover/a.png'),
    `${PROJECT}/storage/v1/object/public/blog-media/cover/a.png`,
  );
});

test("le bucket demande est respecte : on ne coupe pas sur celui d'un autre", () => {
  // Un chemin de `post-media` presente comme `avatars` n'est pas un objet
  // d'`avatars` : on ne doit pas le decouper sur le mauvais marqueur.
  const stored = `${PROJECT}/storage/v1/object/public/post-media/uid/a.png`;
  assert.equal(storagePathOf('avatars', stored), null);
});
