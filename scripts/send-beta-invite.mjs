#!/usr/bin/env node
/**
 * Invitation au test ferme Play Store — envoi ponctuel a une liste d'adresses.
 *
 * ⚠️ POURQUOI CE SCRIPT PLUTOT QUE LE COMPOSEUR DE `/admin/notifications`.
 * Le canal email des campagnes est entierement indexe sur `profiles` :
 * `admin_broadcast_recipients()` ne connait que des comptes, le lien de
 * desabonnement est une signature HMAC posee **sur l'identifiant de compte**
 * (`unsubscribeUrl()`), et `admin_notification_deliveries.recipient_id`
 * reference `profiles(id)` en `not null`. Les beta testeurs n'ont pas encore
 * de compte : les trois mecanismes n'auraient rien a quoi se raccrocher.
 * Les ouvrir aux adresses hors-base est une vraie evolution ; la faire pour
 * un envoi unique affaiblirait trois garanties en echange de rien.
 *
 * Ce script n'ecrit donc **rien en base** — pas de ligne dans
 * `admin_notification_campaigns`. Une campagne journalisee qui n'a vise aucun
 * compte serait un chiffre a l'ecran qu'aucune requete ne soutient.
 *
 * USAGE
 *   node --env-file=.env scripts/send-beta-invite.mjs --url=<lien d'adhesion>
 *   node --env-file=.env scripts/send-beta-invite.mjs --url=<lien> --send
 *
 * Sans `--send`, rien ne part : la liste est validee, le message est rendu
 * dans `scripts/beta-invite.preview.html`, et le script s'arrete.
 *
 * OPTIONS
 *   --url=<...>      Le lien d'adhesion au test (Play Console). Obligatoire.
 *   --list=<chemin>  La liste d'adresses. Defaut : scripts/beta-testers.txt
 *   --lang=fr|en     La langue du message. Defaut : fr
 *   --subject=<...>  Remplace l'objet par defaut.
 *   --run=<etiquette> Force la cle d'idempotence (voir plus bas).
 *   --send           Envoie pour de bon.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resend } from "resend";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Les constantes partagees avec le canal email des campagnes.
//
// ⚠️ Elles sont **recopiees**, pas importees : `lib/email/campaign.ts` est du
// TypeScript qui tire `emails/campaign-email.tsx`, donc du JSX — un script
// Node ne sait pas le charger sans passer par Next. Le couple a surveiller
// est court et il est nomme ici.
// ---------------------------------------------------------------------------
const EMAIL_ADDRESS = "notifications@ifriqiya-soccer.com";
const EMAIL_UNSUBSCRIBE_MAILBOX = "desabonnement@ifriqiya-soccer.com";
const SENDER_NAME = "Ifriqiya Soccer Star";
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "") || "https://www.ifriqiya-soccer.com";

/** Les quatre couleurs de la charte, comme dans le gabarit React Email. */
const INK = "#000000";
const LIME = "#aff70f";
const PAPER = "#FFFFFF";
const MUTED = "#6b6b6b";
const RULE = "#e5e5e5";

const HEADING_FONT = "'Nunito Sans', 'Segoe UI', Arial, Helvetica, sans-serif";
const BODY_FONT = "Poppins, 'Segoe UI', Arial, Helvetica, sans-serif";

/** Maximum documente par Resend pour un appel `batch`. */
const BATCH_SIZE = 100;
const CHUNK_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Les arguments
// ---------------------------------------------------------------------------
const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const optinUrl = (args.get("url") || process.env.BETA_OPTIN_URL || "").trim();
const listPath = resolve(ROOT, args.get("list") || "scripts/beta-testers.txt");
const lang = args.get("lang") === "en" ? "en" : "fr";
const shouldSend = args.get("send") === "true";
const previewPath = resolve(ROOT, "scripts/beta-invite.preview.html");

const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

if (!optinUrl) {
  die("Il manque --url=<lien d'adhesion au test>, celui que donne la Play Console.");
}
if (!/^https:\/\//.test(optinUrl)) {
  die("Le lien d'adhesion doit etre une URL https complete.");
}

// ---------------------------------------------------------------------------
// La liste
//
// ⚠️ Les doublons sont retires **avant** l'envoi, pas apres : deux fois la
// meme adresse dans le fichier, c'est deux courriels identiques recus par la
// meme personne, et Resend n'y voit rien a redire.
// ---------------------------------------------------------------------------
let raw;
try {
  raw = readFileSync(listPath, "utf8");
} catch {
  die(
    `Liste introuvable : ${listPath}\n` +
      "  Creez-la avec une adresse par ligne (les lignes vides et celles commencant par # sont ignorees).",
  );
}

const seen = new Set();
const recipients = [];
const rejected = [];

for (const [index, line] of raw.split(/\r?\n/).entries()) {
  const value = line.trim();
  if (!value || value.startsWith("#")) continue;
  // Un fichier colle depuis un tableur arrive souvent en « Nom <adresse> ».
  const address = (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase();
  // Volontairement permissif : la validation qui compte est celle de Resend,
  // et `batchValidation: "permissive"` nomme l'adresse fautive sans faire
  // echouer les quatre-vingt-dix-neuf autres.
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(address)) {
    rejected.push({ line: index + 1, value });
    continue;
  }
  if (seen.has(address)) continue;
  seen.add(address);
  recipients.push(address);
}

if (!recipients.length) die(`Aucune adresse exploitable dans ${listPath}.`);

// ---------------------------------------------------------------------------
// Le message
// ---------------------------------------------------------------------------
const COPY = {
  fr: {
    subject: "Vous etes invite a tester Ifriqiya Soccer Star",
    preheader: "Votre acces au test de l'application Android.",
    title: "Bienvenue dans le test",
    intro:
      "Vous faites partie des premiers a essayer Ifriqiya Soccer Star avant son ouverture au public. Merci — vos retours changent reellement ce que verront les joueurs.",
    stepsTitle: "Deux etapes, une seule fois",
    steps: [
      "Ouvrez le lien ci-dessous et acceptez de rejoindre le test.",
      "Revenez ensuite au Play Store pour installer l'application.",
    ],
    cta: "Rejoindre le test",
    warningTitle: "A savoir",
    warning:
      "Le lien ne fonctionne qu'avec le compte Google correspondant a l'adresse qui a recu ce message. L'installation peut demander quelques minutes avant d'etre proposee.",
    feedback:
      "Un probleme, une idee, un ecran qui ne se comporte pas comme attendu ? Repondez simplement a ce message.",
    footerWhy:
      "Vous recevez ce message parce que votre adresse a ete inscrite a la phase de test de l'application.",
    unsubscribeHint: `Pour ne plus rien recevoir, ecrivez a ${EMAIL_UNSUBSCRIBE_MAILBOX}.`,
    rights: "Ifriqiya Soccer Star — Tous droits reserves",
  },
  en: {
    subject: "You are invited to test Ifriqiya Soccer Star",
    preheader: "Your access to the Android app test.",
    title: "Welcome to the test",
    intro:
      "You are among the first to try Ifriqiya Soccer Star before it opens to the public. Thank you — your feedback genuinely shapes what players will see.",
    stepsTitle: "Two steps, once",
    steps: [
      "Open the link below and accept to join the test.",
      "Then return to the Play Store to install the app.",
    ],
    cta: "Join the test",
    warningTitle: "Good to know",
    warning:
      "The link only works with the Google account matching the address that received this message. The install may take a few minutes to become available.",
    feedback:
      "A problem, an idea, a screen behaving oddly? Just reply to this message.",
    footerWhy:
      "You are receiving this because your address was added to the app's testing phase.",
    unsubscribeHint: `To stop receiving these, write to ${EMAIL_UNSUBSCRIBE_MAILBOX}.`,
    rights: "Ifriqiya Soccer Star — All rights reserved",
  },
}[lang];

const subject = args.get("subject") || COPY.subject;

// ⚠️ Tout ce qui entre dans le HTML est echappe, y compris le lien : il vient
// de la ligne de commande, et un `"` y fermerait l'attribut `href`.
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const p = (text) =>
  `<p style="color:${INK};font-family:${BODY_FONT};font-size:15px;line-height:1.7;margin:0 0 14px">${escapeHtml(text)}</p>`;

/**
 * ⚠️ Rien de moderne ici non plus : tableaux, styles en ligne, aucune
 * propriete logique. Outlook ne rend ni flexbox, ni grille, ni variable CSS,
 * et `padding-inline-end` y serait ignore — le logo viendrait toucher le nom.
 */
const html = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="background-color:#f4f4f4;margin:0;padding:24px 0">
    <!-- Le preheader : la ligne grise affichee a cote de l'objet. Sans lui,
         le client de messagerie y met le premier texte trouve. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(COPY.preheader)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
                 style="background-color:${PAPER};border-radius:12px;margin:24px auto;max-width:600px;overflow:hidden;width:100%">
            <!-- L'entete. Le signe porte alt="" et le nom est ecrit a cote :
                 la plupart des clients bloquent les images par defaut, donc
                 l'expediteur doit se lire sans elle. -->
            <tr>
              <td style="background-color:${INK};padding:16px 24px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle">
                      <img src="${SITE_URL}/brand/ifriqiya-star-mark.png" alt="" width="11" height="32" style="display:block" />
                    </td>
                    <td style="vertical-align:middle">
                      <span style="color:${PAPER};font-family:${HEADING_FONT};font-size:15px;font-weight:800;letter-spacing:0.02em">${SENDER_NAME}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 24px 8px">
                <h1 style="color:${INK};font-family:${HEADING_FONT};font-size:22px;font-weight:800;line-height:1.3;margin:0 0 16px">${escapeHtml(COPY.title)}</h1>
                ${p(COPY.intro)}
                <p style="color:${INK};font-family:${HEADING_FONT};font-size:14px;font-weight:700;margin:22px 0 10px">${escapeHtml(COPY.stepsTitle)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  ${COPY.steps
                    .map(
                      (step, index) => `<tr>
                    <td style="padding:0 10px 10px 0;vertical-align:top">
                      <span style="background-color:${LIME};border-radius:999px;color:${INK};display:inline-block;font-family:${BODY_FONT};font-size:12px;font-weight:700;height:22px;line-height:22px;text-align:center;width:22px">${index + 1}</span>
                    </td>
                    <td style="color:${INK};font-family:${BODY_FONT};font-size:15px;line-height:1.6;padding:0 0 10px;vertical-align:top">${escapeHtml(step)}</td>
                  </tr>`,
                    )
                    .join("\n                  ")}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 24px 28px">
                <!-- Un <a> stylise, pas un bouton : c'est ce que tous les
                     clients rendent de la meme facon. -->
                <a href="${escapeHtml(optinUrl)}"
                   style="background-color:${LIME};border-radius:8px;color:${INK};display:inline-block;font-family:${BODY_FONT};font-size:14px;font-weight:700;padding:12px 22px;text-decoration:none">${escapeHtml(COPY.cta)}</a>
                <!-- ⚠️ Le lien est aussi ecrit en clair : un client qui
                     n'affiche pas le bouton laisserait sinon l'invitation
                     sans aucun moyen de rejoindre le test. -->
                <p style="color:${MUTED};font-family:${BODY_FONT};font-size:12px;line-height:1.6;margin:14px 0 0;word-break:break-all">${escapeHtml(optinUrl)}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 24px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                       style="background-color:#f7f7f7;border-radius:8px">
                  <tr>
                    <td style="padding:16px 18px">
                      <p style="color:${INK};font-family:${HEADING_FONT};font-size:13px;font-weight:700;margin:0 0 6px">${escapeHtml(COPY.warningTitle)}</p>
                      <p style="color:${INK};font-family:${BODY_FONT};font-size:13px;line-height:1.6;margin:0">${escapeHtml(COPY.warning)}</p>
                    </td>
                  </tr>
                </table>
                <p style="color:${INK};font-family:${BODY_FONT};font-size:14px;line-height:1.7;margin:18px 0 0">${escapeHtml(COPY.feedback)}</p>
              </td>
            </tr>

            <tr><td style="border-top:1px solid ${RULE};font-size:0;line-height:0">&nbsp;</td></tr>

            <tr>
              <td style="padding:18px 24px 24px">
                <p style="color:${MUTED};font-family:${BODY_FONT};font-size:12px;line-height:1.6;margin:0 0 6px">${escapeHtml(COPY.footerWhy)}</p>
                <p style="color:${MUTED};font-family:${BODY_FONT};font-size:11px;line-height:1.6;margin:0 0 10px">${escapeHtml(COPY.unsubscribeHint)}</p>
                <p style="color:#9a9a9a;font-family:${BODY_FONT};font-size:11px;margin:0">${escapeHtml(COPY.rights)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

// La version texte n'est pas une politesse : un message sans `text/plain` est
// declasse par une partie des filtres anti-spam.
const text = [
  COPY.title,
  "",
  COPY.intro,
  "",
  COPY.stepsTitle,
  ...COPY.steps.map((step, index) => `${index + 1}. ${step}`),
  "",
  `${COPY.cta} : ${optinUrl}`,
  "",
  `${COPY.warningTitle} : ${COPY.warning}`,
  "",
  COPY.feedback,
  "",
  "—",
  COPY.footerWhy,
  COPY.unsubscribeHint,
  COPY.rights,
].join("\n");

// ---------------------------------------------------------------------------
// Le compte rendu, puis l'envoi
// ---------------------------------------------------------------------------
/**
 * ⚠️ **La cle d'idempotence, et ce qu'elle protege exactement.**
 *
 * Mesure faite en ecrivant ce script : un appel a `/emails/batch` a repondu
 * « Unable to fetch data » alors que le reseau etait bon — une panne
 * passagere cote Resend. Le lot entier est compte en echec, et relancer la
 * commande **renverrait** aux destinataires des lots qui, eux, etaient
 * partis. La cle derive de l'objet, du lien et de la liste : relancer la
 * **meme** commande ne double rien (Resend rejoue sa reponse, 24 h durant).
 *
 * ⚠️ Son revers, qui se lit ici plutot que se decouvre : **modifier la liste
 * change la cle**, et tout le monde recoit a nouveau. Pour inviter des
 * testeurs ajoutes apres coup, envoyez-leur une liste ne contenant **qu'eux**
 * — c'est de toute facon le geste naturel.
 */
const runKey =
  args.get("run") ||
  createHash("sha256")
    .update(`${subject}|${optinUrl}|${recipients.join(",")}`)
    .digest("base64url")
    .slice(0, 32);

writeFileSync(previewPath, html, "utf8");

console.log(`\n  Liste        ${listPath}`);
console.log(`  Adresses     ${recipients.length} (doublons retires)`);
if (rejected.length) {
  console.log(`  Ignorees     ${rejected.length} ligne(s) illisible(s) :`);
  for (const row of rejected) console.log(`                 ligne ${row.line} : ${row.value}`);
}
console.log(`  Objet        ${subject}`);
console.log(`  Lien         ${optinUrl}`);
console.log(`  Apercu       ${previewPath}`);
console.log(`  Reprise      ${runKey}  (relancer a l'identique ne double pas les envois)`);

if (!shouldSend) {
  console.log("\n  Essai a blanc : rien n'est parti.");
  console.log("  Ouvrez l'apercu, puis relancez la meme commande avec --send.\n");
  process.exit(0);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  die("RESEND_API_KEY est absente. Lancez le script avec `node --env-file=.env`.");
}

const resend = new Resend(apiKey);

/**
 * ⚠️ **Un message par destinataire, jamais un `to` collectif.** Cent adresses
 * dans un meme `to` les montrent toutes a chacun — et pour une liste de
 * testeurs, c'est la liste des testeurs qui fuite.
 *
 * ⚠️ **Pas de `topicId`.** La thematique des campagnes porte les annonces du
 * produit ; un desabonnement a celles-ci ne dit rien d'une invitation au
 * test, et l'attacher ferait **silencieusement** sauter des destinataires.
 * L'en-tete `List-Unsubscribe` en mailto tient le role, comme le fait deja
 * `sendCampaignEmails()` quand le lien signe n'existe pas.
 */

const messages = recipients.map((address) => ({
  from: `${SENDER_NAME} <${EMAIL_ADDRESS}>`,
  to: [address],
  subject,
  html,
  text,
  headers: {
    // RFC 2369 : sans cet en-tete, Gmail et Yahoo declassent un envoi groupe.
    "List-Unsubscribe": `<mailto:${EMAIL_UNSUBSCRIBE_MAILBOX}>`,
  },
  tags: [{ name: "source", value: "beta_invite" }],
}));

const chunk = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

let sent = 0;
const failures = [];

console.log("\n  Envoi en cours...");

for (const [index, lot] of chunk(messages, BATCH_SIZE).entries()) {
  if (index > 0) await wait(CHUNK_DELAY_MS);
  try {
    const response = await resend.batch.send(lot, {
      // Relancer apres une panne passagere ne doit pas doubler les envois
      // deja partis dans les autres lots.
      idempotencyKey: `beta-${runKey}-${index}`,
      // ⚠️ `"permissive"` : en mode strict, une seule adresse malformee fait
      // echouer le lot entier et quatre-vingt-dix-neuf personnes ne recoivent
      // rien a cause d'une faute de frappe.
      batchValidation: "permissive",
    });

    if (response.error) {
      for (const message of lot) failures.push({ to: message.to[0], reason: response.error.message });
      continue;
    }

    const errorByIndex = new Map((response.data?.errors ?? []).map((row) => [row.index, row.message]));
    lot.forEach((message, position) => {
      const reason = errorByIndex.get(position);
      if (reason) failures.push({ to: message.to[0], reason });
      else sent += 1;
    });
  } catch (error) {
    for (const message of lot) {
      failures.push({ to: message.to[0], reason: error?.message ?? "panne reseau" });
    }
  }
}

console.log(`\n  Envoyes      ${sent}`);
if (failures.length) {
  console.log(`  Echecs       ${failures.length} :`);
  for (const row of failures) console.log(`                 ${row.to} — ${row.reason}`);
}
console.log("");

// Un echec partiel reste un echec : le code de sortie le dit, pour qu'un
// relancement automatique ne prenne pas un envoi troue pour un succes.
process.exit(failures.length ? 1 : 0);
