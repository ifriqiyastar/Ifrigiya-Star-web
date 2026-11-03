// Le canal email des campagnes : ce que ce fichier garde, et pourquoi.
//
// Trois defauts possibles ici ne se voient pas a l'oeil et ne cassent aucune
// compilation : un `full_name` injecte du HTML dans la boite de milliers de
// gens ; l'arabe part en `dir="ltr"` et devient illisible ; un lien de
// desabonnement accepte un jeton qui n'est pas le sien. Les trois sont
// verifies ci-dessous sur le **vrai** gabarit et le **vrai** module de signature.
//
// Ce que ce fichier ne couvre PAS : l'appel a Resend lui-meme. Il n'est pas
// simule — un test qui verifierait un faux client ne dirait rien de l'envoi
// reel, qui a ete mesure a la main contre `delivered@resend.dev`.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
process.env.EMAIL_UNSUBSCRIBE_SECRET ||= 'secret-de-test-uniquement';
process.env.NEXT_PUBLIC_SITE_URL ||= 'https://exemple.test';

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
  return load.call(this, name, ...args);
};

const { render } = require('@react-email/render');
const { CampaignEmail } = require('../emails/campaign-email.tsx');
const { EMAIL_COPY, emailLocale, resolveEmailCopy, NAME_TOKEN } = require('../emails/copy.ts');
const { parseAddressList, MAX_TYPED_ADDRESSES } = require('../lib/email/address-list.ts');
const {
  unsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  emailUnsubscribeToken,
  verifyEmailUnsubscribeToken,
  emailUnsubscribeUrl,
  fillTemplate,
  TEMPLATE_SLOTS,
  sanitizeSenderNameForTest,
} = require('../lib/email/campaign.ts');
const { LOCALES } = require('../lib/i18n/config.ts');
const { parseRichText, richToPlainText } = require('../lib/rich-text/server.ts');
const { normalizeBlocks, DEFAULT_BLOCKS } = require('../lib/email/blocks.ts');

const ID = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';

const renderFor = (props) =>
  render(
    CampaignEmail({
      title: 'Titre',
      body: 'Ligne un.\nLigne deux.',
      locale: 'fr',
      siteUrl: 'https://exemple.test',
      ...props,
    }),
  );

test('les trois langues du site ont leur habillage de courriel', () => {
  for (const locale of LOCALES) {
    const copy = EMAIL_COPY[locale];
    assert.ok(copy, `Langue sans habillage : ${locale}`);
    for (const key of ['greetingNamed', 'greetingPlain', 'ctaLabel', 'footerWhy',
                       'unsubscribeLabel', 'unsubscribeHint', 'rights']) {
      assert.ok(copy[key] && copy[key].trim(), `${locale}.${key} vide`);
    }
    // L'accueil « avec nom » doit porter le jeton, sinon le nom disparait.
    assert.ok(copy.greetingNamed.includes(NAME_TOKEN), `${locale} : accueil sans ${NAME_TOKEN}`);
    assert.ok(!copy.greetingPlain.includes(NAME_TOKEN), `${locale} : accueil sans nom porte le jeton`);
  }
  // La langue d'un profil est ramenee a une des trois, jamais laissee brute.
  assert.equal(emailLocale('ar'), 'ar');
  assert.equal(emailLocale('en-GB'), 'en');
  assert.equal(emailLocale(null), 'fr');
  assert.equal(emailLocale('klingon'), 'fr');
});

test('une personnalisation partielle retombe sur les defauts livres', () => {
  const site = 'https://exemple.test';
  // Rien en base : exactement les defauts.
  const none = resolveEmailCopy('fr', null, site);
  assert.equal(none.ctaLabel, EMAIL_COPY.fr.ctaLabel);
  assert.equal(none.rights, EMAIL_COPY.fr.rights);
  assert.equal(none.ctaUrl, site);
  assert.equal(none.showCta, true);

  // Une ligne partielle ne remplace que ce qu'elle porte, et une chaine vide
  // vaut « non renseigne » — sinon enregistrer un champ vide effacerait la
  // mention legale du pied de page sans que personne ne le voie.
  const partial = resolveEmailCopy('fr', {
    locale: 'fr', cta_label: 'Voir la session', cta_url: 'https://x.test/s',
    rights: '   ', show_cta: false, sender_name: null, reply_to: 'a@b.test',
    greeting_named: null, greeting_plain: null, signature: 'L\'equipe',
    footer_why: null, unsubscribe_label: null, unsubscribe_hint: null,
  }, site);
  assert.equal(partial.ctaLabel, 'Voir la session');
  assert.equal(partial.ctaUrl, 'https://x.test/s');
  assert.equal(partial.rights, EMAIL_COPY.fr.rights);
  assert.equal(partial.showCta, false);
  assert.equal(partial.replyTo, 'a@b.test');
  assert.equal(partial.signature, "L'equipe");

  // ⚠️ Le sens de lecture n'est pas personnalisable : l'arabe reste rtl quoi
  // qu'on enregistre, sinon un reglage maladroit rend le courriel illisible.
  assert.equal(resolveEmailCopy('ar', { locale: 'ar' }, site).dir, 'rtl');
});

test("l'arabe part en lecture de droite a gauche", async () => {
  const arabic = await renderFor({ locale: 'ar' });
  assert.match(arabic, /dir="rtl"/);
  assert.match(arabic, /lang="ar"/);
  const french = await renderFor({ locale: 'fr' });
  assert.match(french, /dir="ltr"/);
  // Temoin : sans le `dir`, ce test passerait pour de mauvaises raisons.
  assert.doesNotMatch(french, /dir="rtl"/);
});

test("un nom de compte ne peut pas injecter de HTML dans le courriel", async () => {
  // Chemin 1 — le nom passe par React, qui echappe lui-meme.
  const direct = await renderFor({ recipientName: '<script>alert(1)</script>' });
  assert.doesNotMatch(direct, /<script>alert/);
  assert.match(direct, /&lt;script&gt;/);

  // ⚠️ Chemin 2 — celui que l'envoi emprunte reellement. Le gabarit est rendu
  // une fois avec un marqueur, puis le nom est pose dans du HTML **deja
  // rendu** : React n'est plus la, et seul `fillTemplate()` echappe. Une
  // premiere version de ce test ne verifiait que le chemin 1 et restait verte
  // apres suppression de l'echappement — elle mesurait React, pas ce code.
  const gabarit = await renderFor({ recipientName: TEMPLATE_SLOTS.name });
  const rempli = fillTemplate({ html: gabarit, text: gabarit }, '<script>alert(1)</script>', null);
  assert.doesNotMatch(rempli.html, /<script>alert/);
  assert.match(rempli.html, /&lt;script&gt;/);
  // Le guillemet aussi : un nom pose dans un attribut refermerait la valeur.
  const guillemet = fillTemplate({ html: gabarit, text: gabarit }, 'a" onload="x', null);
  assert.doesNotMatch(guillemet.html, /a" onload="x/);
});

test('les sauts de ligne de la saisie deviennent des paragraphes', async () => {
  const html = await renderFor({ body: 'Un.\n\nDeux.\nTrois.' });
  for (const line of ['Un.', 'Deux.', 'Trois.']) {
    assert.ok(html.includes(`>${line}<`), `Paragraphe manquant : ${line}`);
  }
});

test('un lien de desabonnement ne vaut que pour son propre compte', () => {
  const token = unsubscribeToken(ID);
  assert.ok(token);
  assert.equal(verifyUnsubscribeToken(ID, token), true);
  // Le jeton d'un compte ne desabonne pas le voisin.
  assert.equal(verifyUnsubscribeToken(OTHER, token), false);
  // Ni un jeton tronque, ni un jeton bricole, ni rien du tout.
  assert.equal(verifyUnsubscribeToken(ID, token.slice(0, -1)), false);
  assert.equal(verifyUnsubscribeToken(ID, `${token.slice(0, -1)}X`), false);
  assert.equal(verifyUnsubscribeToken(ID, ''), false);
  assert.match(unsubscribeUrl(ID), new RegExp(`c=${ID}&t=`));
});

test("aucun jeton de gabarit ne survit au rendu", async () => {
  const html = await renderFor({ recipientName: 'Amine', unsubscribeUrl: 'https://exemple.test/u' });
  // Les marqueurs de substitution ne doivent jamais atteindre une boite mail.
  assert.doesNotMatch(html, /__IFQ_/);
  assert.match(html, /https:\/\/exemple\.test\/u/);
});

test("un nom d'expediteur ne peut pas injecter d'en-tete", () => {
  // ⚠️ Un retour a la ligne dans `From:` permet d'ajouter un en-tete a la
  // suite — un `Bcc:` vers un tiers, par exemple. Les chevrons et les
  // guillemets casseraient la syntaxe `Nom <adresse>`.
  assert.equal(sanitizeSenderNameForTest("Ifriqiya\r\nBcc: espion@x.test"), "Ifriqiya Bcc: espion@x.test");
  assert.doesNotMatch(sanitizeSenderNameForTest("a\nb"), /\n/);
  assert.equal(sanitizeSenderNameForTest('Nom <autre@x.test>'), "Nom autre@x.test");
  // Un nom vide retombe sur la marque plutot que de produire « <adresse> ».
  assert.equal(sanitizeSenderNameForTest("   "), "Ifriqiya Soccer Star");
  // Et il reste borne : un en-tete n'accueille pas un roman.
  assert.ok(sanitizeSenderNameForTest("x".repeat(400)).length <= 78);
});

test("le message mis en forme ne peut pas injecter de HTML", async () => {
  // ⚠️ Le coeur de la surete du message riche. Le HTML vient du navigateur,
  // donc d'un client : il est reanalyse contre le schema Tiptap, qui est une
  // liste blanche, puis le courriel est **reconstruit** a partir de l'arbre.
  // Aucune chaine du client n'est jamais posee comme du HTML.
  const doc = parseRichText(
    '<p>Bonjour <script>alert(1)</script></p>' +
    '<p><a href="javascript:alert(2)">piege</a> et <a href="https://ok.test">vrai</a></p>' +
    '<img src=x onerror="alert(3)"><iframe src="https://evil.test"></iframe>' +
    '<p style="position:fixed" onclick="alert(4)" class="x">style</p>',
  );
  assert.ok(doc, 'le document devrait exister');

  const html = await render(
    CampaignEmail({
      title: 'T', body: richToPlainText(doc), bodyDoc: doc, locale: 'fr',
      siteUrl: 'https://exemple.test',
    }),
  );
  for (const [name, pattern] of [
    ['script', /<script/i], ['onerror', /onerror/i], ['iframe', /<iframe/i],
    ['onclick', /onclick/i], ['javascript:', /javascript:/i], ['position:fixed', /position:fixed/i],
  ]) {
    assert.doesNotMatch(html, pattern, `${name} a survecu au rendu`);
  }
  // Temoin : un lien legitime doit passer, sinon le test serait vert parce
  // que tout est jete.
  assert.match(html, /https:\/\/ok\.test/);
});

test('le texte brut est derive du message mis en forme', () => {
  // ⚠️ La notification in-app et le push ne rendent aucun balisage : ils
  // recoivent ce texte-la. Il est derive, jamais saisi a part, pour que les
  // deux ne puissent pas raconter deux choses differentes.
  const doc = parseRichText(
    '<h2>Session</h2><p>Inscriptions <strong>ouvertes</strong>.</p><ul><li>Piece</li><li>Crampons</li></ul>',
  );
  assert.equal(
    richToPlainText(doc),
    'Session\nInscriptions ouvertes.\n— Piece\n— Crampons',
  );
  // Un contenu vide ne produit ni document ni texte : l'appelant retombe
  // alors sur la saisie brute, qui existe toujours.
  assert.equal(parseRichText(''), null);
  assert.equal(parseRichText('<p></p>'), null);
  assert.equal(richToPlainText(null), '');
});

// Ce que ce test garde : qu'un modele puisse n'avoir **aucune** formule
// d'accueil. Vider les deux champs ne suffit pas — une chaine vide vaut « non
// renseigne » et fait revenir le texte livre —, donc la seule facon de le
// dire est l'interrupteur `show_greeting` (`202611030001`).
//
// ⚠️ Verifie par mutation : rendre inconditionnel le rendu de l'accueil dans
// `emails/campaign-email.tsx` (retirer `|| !copy.showGreeting`) fait tomber
// le deuxieme cas. Le premier est le temoin — sans lui, un gabarit qui
// n'afficherait **jamais** d'accueil passerait le test sans rien prouver.
//
// Ce qu'il ne couvre PAS : l'ecriture de la colonne par le Server Action, ni
// son repli quand la migration n'est pas appliquee.
test("la formule d'accueil se retire entierement, et seulement si on le demande", async () => {
  const site = 'https://exemple.test';
  const base = {
    locale: 'fr', sender_name: null, reply_to: null,
    greeting_named: 'Bonjour,', greeting_plain: 'Bonjour,',
    show_cta: false, cta_label: null, cta_url: null, signature: null,
    footer_why: null, unsubscribe_label: null, unsubscribe_hint: null, rights: null,
  };
  const html = async (row, recipientName) =>
    renderFor({ copy: resolveEmailCopy('fr', row, site), recipientName });

  // Temoin : par defaut, l'accueil est bien la — pour les deux branches,
  // avec et sans nom de destinataire.
  assert.match(await html(base), /Bonjour,/);
  assert.match(await html({ ...base, greeting_named: 'Bonjour {nom},' }, 'Karim'), /Bonjour Karim,/);

  // Decoche : plus aucune ligne d'accueil, quel que soit le destinataire.
  assert.doesNotMatch(await html({ ...base, show_greeting: false }), /Bonjour/);
  assert.doesNotMatch(
    await html({ ...base, greeting_named: 'Bonjour {nom},', show_greeting: false }, 'Karim'),
    /Bonjour/,
  );

  // ⚠️ Colonne absente (projet ou la migration n'est pas passee) : l'accueil
  // reste affiche. Une migration manquante ne doit pas effacer du contenu.
  const sansColonne = { ...base };
  delete sansColonne.show_greeting;
  assert.equal(resolveEmailCopy('fr', sansColonne, site).showGreeting, true);
  assert.match(await html(sansColonne), /Bonjour,/);
});

test('les couleurs enregistrees ne passent que si elles sont des #rrggbb', () => {
  const site = 'https://exemple.test';
  const base = resolveEmailCopy('fr', null, site).colors;
  assert.equal(base.buttonBg, '#aff70f');

  const custom = resolveEmailCopy('fr', {
    locale: 'fr', color_header_bg: '#123456',
    // ⚠️ Chacune de ces valeurs finirait dans un attribut `style` : une
    // couleur refusee doit retomber sur la charte, pas s'y glisser.
    color_button_bg: 'red',
    color_text: '#fff',
    color_body_bg: '#ffffff; position:fixed',
  }, site).colors;
  assert.equal(custom.headerBg, '#123456');
  assert.equal(custom.buttonBg, base.buttonBg);
  assert.equal(custom.text, base.text);
  assert.equal(custom.bodyBg, base.bodyBg);
});

test("le rendu revalide le lien, meme si le schema l'a deja filtre", async () => {
  // ⚠️ Ce test construit l'arbre **a la main**, sans passer par le schema.
  // C'est volontaire : `parseRichText` jette deja les liens `javascript:`,
  // donc le garde de `RichBody` est inatteignable par le chemin normal — et
  // une premiere version de ce fichier restait verte apres l'avoir supprime.
  // Un second garde ne vaut que s'il est verifie pour lui-meme : il protege
  // le jour ou le schema change, ou si un autre appelant produit l'arbre.
  const forged = {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'piege', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
        { type: 'text', text: 'donnee', marks: [{ type: 'link', attrs: { href: 'data:text/html,x' } }] },
        { type: 'text', text: 'vrai', marks: [{ type: 'link', attrs: { href: 'https://ok.test' } }] },
      ],
    }],
  };
  const html = await render(
    CampaignEmail({ title: 'T', body: 'x', bodyDoc: forged, locale: 'fr', siteUrl: 'https://exemple.test' }),
  );
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  // Le texte reste lisible, seule la mise en lien disparait.
  assert.match(html, /piege/);
  assert.match(html, /https:\/\/ok\.test/);
});

test('la mise en page est reconstruite contre une liste blanche', () => {
  // ⚠️ La colonne `blocks` est du JSON libre venu d'un formulaire. Rien n'y
  // est filtre : la liste est **reconstruite** bloc par bloc, champ par
  // champ. Un type inconnu, une cle en trop, une adresse qui n'est pas
  // http/https/mailto n'ont pas de branche et disparaissent.
  const out = normalizeBlocks([
    { id: 'x1', type: 'script', src: 'evil.js' },
    { id: 'x2', type: 'image', src: 'javascript:alert(1)', alt: { fr: 'a' } },
    { id: 'x3', type: 'button', label: { fr: 'ok' }, href: 'data:text/html,x' },
    { id: 'x4', type: 'text', text: { fr: 'garde', zz: 'langue inventee' }, onclick: 'alert(1)' },
    { id: 'x5', type: 'message' },
    { id: 'x6', type: 'message' },
    { id: 'x7', type: 'image', src: 'https://ok.test/a.png', alt: { fr: 'photo' }, href: 'https://ok.test' },
  ]);
  const types = out.map((block) => block.type);
  assert.deepEqual(types, ['text', 'message', 'image'], 'types retenus');
  // Une langue inventee et une cle parasite ne survivent pas a la recopie.
  assert.deepEqual(out[0], { id: 'x4', type: 'text', text: { fr: 'garde' } });
  // ⚠️ Un seul emplacement de message : deux enverraient le texte deux fois.
  assert.equal(types.filter((type) => type === 'message').length, 1);
  assert.equal(out[2].width, 'full');
});

test("la mise en page garde toujours un emplacement pour le message", () => {
  // Sans bloc `message`, ce que l'administrateur ecrit a l'envoi n'aurait
  // nulle part ou aller et disparaitrait sans un mot.
  const out = normalizeBlocks([{ id: 'a', type: 'divider' }]);
  assert.equal(out.at(-1).type, 'message');
  // Une valeur absurde retombe sur la mise en page par defaut.
  assert.deepEqual(normalizeBlocks(null), DEFAULT_BLOCKS);
  assert.deepEqual(normalizeBlocks('rien'), DEFAULT_BLOCKS);
  assert.deepEqual(normalizeBlocks([{ type: 'inconnu' }]), DEFAULT_BLOCKS);
});

test("le bouton de l'habillage s'efface devant celui de la mise en page", async () => {
  // ⚠️ Deux appels a l'action l'un sous l'autre : le defaut se voyait a
  // l'ecran des le premier modele compose avec un bouton.
  const blocks = normalizeBlocks([
    { id: 'm', type: 'message' },
    { id: 'b', type: 'button', label: { fr: 'Je participe' }, href: 'https://ok.test' },
  ]);
  const withBlock = await render(
    CampaignEmail({ title: 'T', body: 'x', blocks, locale: 'fr', siteUrl: 'https://exemple.test' }),
  );
  // ⚠️ L'apostrophe est echappee dans le HTML rendu (`&#x27;`). Une premiere
  // version cherchait `Ouvrir l'application` en clair : le `doesNotMatch`
  // passait alors **sans rien prouver**, puisque le motif ne pouvait de
  // toute facon jamais correspondre. C'est le temoin ci-dessous qui l'a
  // revele — d'ou sa presence.
  const CTA = /Ouvrir l(&#x27;|')application/;
  assert.match(withBlock, /Je participe/);
  assert.doesNotMatch(withBlock, CTA);

  // Temoin : sans bouton dans la mise en page, celui de l'habillage revient.
  const without = await render(
    CampaignEmail({
      title: 'T', body: 'x', blocks: normalizeBlocks([{ id: 'm', type: 'message' }]),
      locale: 'fr', siteUrl: 'https://exemple.test',
    }),
  );
  assert.match(without, CTA);
});

// ---------------------------------------------------------------------------
// L'objet n'est pas le titre affiche
//
// Signale par le client : « le sujet apparait dans le modele ». Le meme champ
// servait d'objet — la ligne lue dans la boite de reception — et de titre pose
// en gros sous l'entete, si bien que le destinataire lisait deux fois la meme
// phrase. `heading` les separe.
//
// ⚠️ CE QUI FAIT ECHOUER CE TEST SI LE DEFAUT REVIENT : rendre a nouveau
// `title` dans le bloc message (`emails/blocks.tsx`, `message.title`), ou
// perdre la prop `heading` en chemin — la premiere assertion tombe. Le
// troisieme cas est le temoin : sans lui, un gabarit qui n'afficherait
// **jamais** de titre passerait le test sans rien prouver.
//
// Ce qu'il ne couvre PAS : quel appelant passe quoi. La regle « le titre
// affiche n'existe que si le courriel reprend celui de la notification » vit
// dans `lib/actions/notifications.ts` et n'est pas exercee ici.
test("l'objet du courriel ne se repete pas en titre dans le message", async () => {
  const SUBJECT = 'Objet-Qui-Ne-Doit-Pas-Paraitre';

  // 1. `heading: null` — le courriel a son propre objet : aucun titre affiche.
  const sansTitre = await renderFor({ title: SUBJECT, heading: null });
  assert.doesNotMatch(
    sansTitre,
    new RegExp(`<h1[^>]*>[\\s\\S]*${SUBJECT}`),
    "l'objet est pose en titre alors que heading vaut null",
  );
  // Il reste le preheader : c'est sa place, et elle n'est pas lue dans le corps.
  assert.match(sansTitre, new RegExp(SUBJECT), 'le preheader a perdu l\'objet');

  // 2. `heading` distinct — c'est lui qu'on lit en tete, pas l'objet.
  const avecTitre = await renderFor({ title: SUBJECT, heading: 'Titre-Affiche' });
  assert.match(avecTitre, /<h1[^>]*>[\s\S]*Titre-Affiche/);
  assert.doesNotMatch(avecTitre, new RegExp(`<h1[^>]*>[\\s\\S]*${SUBJECT}`));

  // 3. Temoin. `heading` absent = l'ancien comportement, l'objet coiffe le
  //    message. Sans cette assertion, un gabarit ayant perdu son `<h1>` pour
  //    de bon laisserait les deux premieres passer.
  const defaut = await renderFor({ title: SUBJECT });
  assert.match(
    defaut,
    new RegExp(`<h1[^>]*>[\\s\\S]*${SUBJECT}`),
    'le repli (heading absent) ne rend plus de titre : les cas 1 et 2 ne prouvent plus rien',
  );
});

// ---------------------------------------------------------------------------
// Les adresses saisies a la main
//
// Elles n'ont pas de compte : ce qui les protege n'est donc plus le RLS ni
// `admin_broadcast_recipients()`, mais ces deux fonctions. Trois defauts
// possibles ne se verraient ni a la compilation ni a l'oeil : un doublon part
// deux fois, un surplus est coupe en silence, et un jeton emis pour un compte
// desabonne une adresse (ou l'inverse).
//
// ⚠️ CE QUI FAIT ECHOUER CES TESTS SI LE DEFAUT REVIENT : retirer la
// separation de domaine dans `emailUnsubscribeToken` (prefixe `unsubscribe-`
// contre `unsubscribe-email-`), ou cesser de compter `overflow`/`duplicates`
// pour se contenter d'un `slice`.
//
// Ce qu'ils ne couvrent PAS : le filtre des desabonnes, qui vit dans le Server
// Action et interroge la base ; ni l'envoi lui-meme.
test('une saisie libre est lue sans rien perdre en silence', () => {
  const lu = parseAddressList(
    'Marie Dupont <MARIE@exemple.com>\nkarim@exemple.com, marie@exemple.com\n\n' +
      'pas-une-adresse; sans-point@local\tzied@exemple.tn',
  );
  // Minuscules, forme « Nom <adresse> » reconnue, separateurs varies.
  assert.deepEqual(lu.emails, ['marie@exemple.com', 'karim@exemple.com', 'zied@exemple.tn']);
  // Le doublon est **compte**, pas seulement retire.
  assert.equal(lu.duplicates, 1);
  // Les deux fragments illisibles sont nommes, pour pouvoir etre corriges.
  assert.deepEqual(lu.invalid, ['pas-une-adresse', 'sans-point@local']);
  assert.equal(lu.overflow, 0);

  // ⚠️ Le plafond ne coupe pas en silence : le surplus se compte.
  const trop = parseAddressList(
    Array.from({ length: MAX_TYPED_ADDRESSES + 7 }, (_, i) => `p${i}@exemple.com`).join('\n'),
  );
  assert.equal(trop.emails.length, MAX_TYPED_ADDRESSES);
  assert.equal(trop.overflow, 7);

  // Un `+` dans la partie locale est valide et circule : l'ecarter serait un
  // faux refus, invisible jusqu'a ce que quelqu'un ne recoive rien.
  assert.deepEqual(parseAddressList('a+beta@exemple.com').emails, ['a+beta@exemple.com']);
});

test("le desabonnement d'une adresse ne se confond pas avec celui d'un compte", () => {
  const ADRESSE = 'Zied@Exemple.TN';
  const jeton = emailUnsubscribeToken(ADRESSE);
  assert.ok(jeton, 'aucun jeton emis');

  // La casse est normalisee des deux cotes, sinon le lien recu refuserait la
  // ligne que la base a enregistree.
  assert.ok(verifyEmailUnsubscribeToken('zied@exemple.tn', jeton));
  assert.ok(verifyEmailUnsubscribeToken('  ZIED@EXEMPLE.TN  ', jeton));
  // Une autre adresse ne passe pas.
  assert.equal(verifyEmailUnsubscribeToken('autre@exemple.tn', jeton), false);

  // ⚠️⚠️ Separation des domaines de signature. Un jeton emis pour un compte
  // ne doit pas desabonner une adresse, ni l'inverse — sans quoi connaitre
  // l'un donnerait l'autre.
  assert.equal(verifyEmailUnsubscribeToken(ID, unsubscribeToken(ID)), false);
  assert.equal(verifyUnsubscribeToken(ID, emailUnsubscribeToken(ID)), false);

  // L'adresse voyage encodee : un `+` lu dans une chaine de requete devient
  // une espace, et le desabonnement porterait alors sur une autre adresse.
  const url = emailUnsubscribeUrl('a+beta@exemple.com');
  assert.match(url, /[?&]e=a%2Bbeta%40exemple\.com(&|$)/);
  assert.equal(new URL(url).searchParams.get('e'), 'a+beta@exemple.com');
});

// ---------------------------------------------------------------------------
// Le modele « Invitation beta testeurs »
//
// Il existe en DEUX exemplaires : la migration le pose en base, et
// `emails/apercus/` le rejoue pour `npm run email`. Deux copies du meme
// contenu derivent toujours, et la derive serait invisible — l'apercu
// montrerait un courriel que personne ne recoit. Ce test les compare.
//
// ⚠️ CE QUI FAIT ECHOUER CE TEST SI LE DEFAUT REVIENT : modifier un texte d'un
// cote seulement, ou retirer l'invitation du modele pour la remettre dans le
// message de la campagne — la derniere assertion tombe alors.
//
// Ce qu'il ne couvre PAS : que la base porte bien ces blocs. Personne ici ne
// parle a Postgres ; il compare deux fichiers du depot.
test('le modele beta dit la meme chose dans la migration et dans l\'apercu', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202611020002_beta_tester_template.sql'), 'utf8');
  const depuisSql = normalizeBlocks(JSON.parse(sql.split('$blocks$')[1]));
  const { BLOCKS: depuisApercu } = require('../emails/apercus/campagne-beta-testeurs.tsx');
  assert.deepEqual(depuisApercu, depuisSql, "l'apercu et la migration ont diverge");

  // ⚠️ L'invitation doit vivre dans le MODELE, pas dans le message de la
  // campagne : sinon le courriel s'ouvre sur un titre a remplir et enchaine
  // sur « trois gestes » sans avoir invite personne. C'est ce qui a ete
  // signale — « ce n'est pas un e-mail d'invitation ».
  const textes = depuisSql
    .filter((b) => b.type === 'text')
    .map((b) => b.text.fr)
    .join(' ');
  assert.match(textes, /invite a essayer/, "le modele n'invite plus personne");
  assert.match(textes, /joueurs et les recruteurs/, "le modele ne dit plus ce qu'est l'application");

  // Le bloc message reste present — `normalizeBlocks` en garantit un — mais il
  // ne porte que la note libre : vide, il ne rend rien.
  assert.equal(depuisSql.filter((b) => b.type === 'message').length, 1);
  // Et toujours aucun jeton de nom nulle part.
  assert.doesNotMatch(JSON.stringify(depuisSql), /\{nom\}|__IFQ_NAME__/);
});
