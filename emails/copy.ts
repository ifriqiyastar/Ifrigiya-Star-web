import type { Locale } from "@/lib/i18n/config";

/**
 * L'habillage du courriel : ce qui entoure le message d'une campagne.
 *
 * ⚠️ Deux sources, et l'ordre compte. Les valeurs ci-dessous sont les
 * **defauts livres** ; un super administrateur peut les remplacer, langue par
 * langue, depuis `/admin/notifications/modele` (table
 * `admin_email_template`). `resolveEmailCopy()` fusionne les deux : une
 * valeur absente en base retombe ici, donc une installation sans la table
 * — ou avec une ligne partielle — envoie exactement ce qu'elle envoyait.
 *
 * ⚠️ Volontairement separe de `messages/admin/*.json`. Le back-office ne
 * parle que francais et anglais parce que ses utilisateurs sont les
 * administrateurs du client ; le destinataire d'une campagne, lui, est un
 * joueur ou un professionnel de l'application mobile, qui peut avoir choisi
 * l'arabe. Le corps du message reste tel que l'administrateur l'a tape — on
 * ne traduit pas ce qu'il a ecrit — mais l'habillage suit `profiles.locale`.
 *
 * Volontairement separe de `messages/*.json` (le site public) aussi : ces
 * dictionnaires-la sont charges par des pages, et une phrase qui n'existe que
 * dans un courriel n'a pas a voyager dans le bundle d'une page d'accueil. Le
 * type `Record<Locale, …>` donne la meme garantie de completude que la parite
 * de cles du dictionnaire : oublier l'arabe ne compile pas.
 */

/** Le jeton que l'accueil « avec nom » doit contenir. */
export const NAME_TOKEN = "{nom}";

export type EmailCopy = {
  /** `dir` de l'element racine : l'arabe se lit de droite a gauche. */
  dir: "ltr" | "rtl";
  /** Accueil quand le compte porte un nom. Contient `{nom}`. */
  greetingNamed: string;
  /** Accueil quand il n'en porte pas — jamais « Bonjour , ». */
  greetingPlain: string;
  ctaLabel: string;
  footerWhy: string;
  unsubscribeLabel: string;
  unsubscribeHint: string;
  rights: string;
};

export const EMAIL_COPY: Record<Locale, EmailCopy> = {
  fr: {
    dir: "ltr",
    greetingNamed: `Bonjour ${NAME_TOKEN},`,
    greetingPlain: "Bonjour,",
    ctaLabel: "Ouvrir l'application",
    footerWhy: "Vous recevez ce message parce que vous avez un compte Ifriqiya Soccer Star.",
    unsubscribeLabel: "Ne plus recevoir ces annonces",
    unsubscribeHint:
      "Vous continuerez a recevoir les messages lies a votre compte (validation, securite).",
    rights: "Ifriqiya Soccer Star — Tous droits reserves",
  },
  en: {
    dir: "ltr",
    greetingNamed: `Hello ${NAME_TOKEN},`,
    greetingPlain: "Hello,",
    ctaLabel: "Open the app",
    footerWhy: "You are receiving this because you have an Ifriqiya Soccer Star account.",
    unsubscribeLabel: "Stop receiving these announcements",
    unsubscribeHint:
      "You will still receive messages about your own account (validation, security).",
    rights: "Ifriqiya Soccer Star — All rights reserved",
  },
  ar: {
    dir: "rtl",
    greetingNamed: `مرحبا ${NAME_TOKEN}،`,
    greetingPlain: "مرحبا،",
    ctaLabel: "افتح التطبيق",
    footerWhy: "تصلك هذه الرسالة لأن لديك حسابا على إفريقية سوكر ستار.",
    unsubscribeLabel: "إيقاف استقبال هذه الإعلانات",
    unsubscribeHint: "ستستمر في تلقي الرسائل المتعلقة بحسابك (التحقق، الأمان).",
    rights: "إفريقية سوكر ستار — جميع الحقوق محفوظة",
  },
};

/** Le nom d'expediteur par defaut, modifiable par langue. */
export const DEFAULT_SENDER_NAME = "Ifriqiya Soccer Star";

/**
 * Les couleurs livrees : celles de la charte, et rien d'autre.
 *
 * ⚠️ Elles sont recopiees ici plutot qu'importees d'`app/globals.css` : un
 * courriel n'a pas de cascade, chaque valeur part en ligne dans un attribut
 * `style`. C'est le seul endroit du depot ou la charte est ecrite deux fois,
 * et c'est une contrainte du format.
 */
export const DEFAULT_COLORS = {
  headerBg: "#000000",
  bodyBg: "#ffffff",
  text: "#2b2b2b",
  buttonBg: "#aff70f",
  buttonText: "#000000",
} as const;

export type EmailColors = { [K in keyof typeof DEFAULT_COLORS]: string };

/** Les pastilles proposees dans le selecteur : les quatre de la charte. */
export const BRAND_SWATCHES = ["#000000", "#aff70f", "#cccccc", "#ffffff"] as const;

/** Une couleur n'entre dans un `style` que si elle est un `#rrggbb`. */
export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim());

/** Ce que la base peut remplacer. Toutes les colonnes sont nullables. */
export type EmailTemplateRow = {
  locale: string;
  sender_name: string | null;
  reply_to: string | null;
  greeting_named: string | null;
  greeting_plain: string | null;
  show_cta: boolean | null;
  cta_label: string | null;
  cta_url: string | null;
  signature: string | null;
  footer_why: string | null;
  unsubscribe_label: string | null;
  unsubscribe_hint: string | null;
  rights: string | null;
  color_header_bg?: string | null;
  color_body_bg?: string | null;
  color_text?: string | null;
  color_button_bg?: string | null;
  color_button_text?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

/** L'habillage effectif d'une langue, defauts et personnalisation fusionnes. */
export type ResolvedEmailCopy = {
  dir: "ltr" | "rtl";
  senderName: string;
  replyTo: string | null;
  greetingNamed: string;
  greetingPlain: string;
  showCta: boolean;
  ctaLabel: string;
  /** `null` = pas de bouton : ni libelle, ni adresse ou l'envoyer. */
  ctaUrl: string | null;
  signature: string | null;
  footerWhy: string;
  unsubscribeLabel: string;
  unsubscribeHint: string;
  rights: string;
  colors: EmailColors;
};

/** Une chaine vide en base vaut « non renseigne », pas « efface le defaut ». */
const pick = (value: string | null | undefined, fallback: string) => {
  const clean = (value ?? "").trim();
  return clean || fallback;
};

/** Une couleur enregistree n'est retenue que si elle est encore valide. */
const pickColor = (value: string | null | undefined, fallback: string) => {
  const clean = (value ?? "").trim();
  return clean && isHexColor(clean) ? clean : fallback;
};

export function resolveEmailCopy(
  locale: Locale,
  row: EmailTemplateRow | null | undefined,
  siteUrl: string,
): ResolvedEmailCopy {
  const base = EMAIL_COPY[locale];
  return {
    // Le sens de lecture n'est **pas** modifiable : il decoule de la langue,
    // et l'arabe en ltr est illisible. Ce n'est pas une preference.
    dir: base.dir,
    senderName: pick(row?.sender_name, DEFAULT_SENDER_NAME),
    replyTo: (row?.reply_to ?? "").trim() || null,
    greetingNamed: pick(row?.greeting_named, base.greetingNamed),
    greetingPlain: pick(row?.greeting_plain, base.greetingPlain),
    showCta: row?.show_cta ?? true,
    ctaLabel: pick(row?.cta_label, base.ctaLabel),
    ctaUrl: (row?.cta_url ?? "").trim() || siteUrl,
    signature: (row?.signature ?? "").trim() || null,
    footerWhy: pick(row?.footer_why, base.footerWhy),
    unsubscribeLabel: pick(row?.unsubscribe_label, base.unsubscribeLabel),
    unsubscribeHint: pick(row?.unsubscribe_hint, base.unsubscribeHint),
    rights: pick(row?.rights, base.rights),
    colors: {
      headerBg: pickColor(row?.color_header_bg, DEFAULT_COLORS.headerBg),
      bodyBg: pickColor(row?.color_body_bg, DEFAULT_COLORS.bodyBg),
      text: pickColor(row?.color_text, DEFAULT_COLORS.text),
      buttonBg: pickColor(row?.color_button_bg, DEFAULT_COLORS.buttonBg),
      buttonText: pickColor(row?.color_button_text, DEFAULT_COLORS.buttonText),
    },
  };
}

/** La langue d'un destinataire, ramenee a une des trois que le site sert. */
export function emailLocale(value: string | null | undefined): Locale {
  const clean = (value ?? "").trim().slice(0, 2).toLowerCase();
  return clean === "en" || clean === "ar" ? clean : "fr";
}
