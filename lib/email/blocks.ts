import { LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * Le corps d'un modele d'e-mail : une liste ordonnee de blocs typés.
 *
 * ⚠️ **Ce module est la frontiere de confiance.** La colonne `blocks` est du
 * JSON libre : elle vient d'un formulaire, donc d'un client. Rien ne doit
 * etre rendu sans etre passe par `normalizeBlocks()`, qui reconstruit chaque
 * bloc champ par champ — un type inconnu disparait, une cle en trop
 * disparait, une adresse qui n'est pas http/https/mailto disparait. On ne
 * filtre pas l'entree, on **recopie** ce qu'on reconnait : une liste noire
 * qui se trompe laisse passer, une liste blanche qui se trompe appauvrit.
 *
 * Les textes sont ranges par langue **dans** le bloc : la mise en page se
 * compose une fois et se traduit trois fois, au lieu d'exister en trois
 * exemplaires qui divergeraient.
 */

export const BLOCK_TYPES = [
  "greeting",
  "message",
  "signature",
  "text",
  "image",
  "button",
  "columns",
  "divider",
  "spacer",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Un texte par langue. Une langue absente retombe sur le francais. */
export type LocalizedText = Partial<Record<Locale, string>>;

export type EmailBlock =
  /**
   * La formule d'accueil. En bloc plutot qu'en champ d'habillage : c'est du
   * contenu, il se deplace et se retire comme le reste. Deux textes parce
   * qu'un accueil sans nom ne se rattrape pas par expression reguliere —
   * meme raison que dans l'habillage.
   */
  | { id: string; type: "greeting"; named: LocalizedText; plain: LocalizedText }
  /** L'emplacement du titre **et** du message de la campagne. Au plus un. */
  | { id: string; type: "message" }
  /** La signature, posee ou on veut plutot qu'a une place fixe. */
  | { id: string; type: "signature"; text: LocalizedText }
  | { id: string; type: "text"; text: LocalizedText }
  | {
      id: string;
      type: "image";
      src: string;
      alt: LocalizedText;
      href: string | null;
      /** `full` occupe la largeur du courriel ; `auto` garde la taille du fichier. */
      width: "full" | "auto";
    }
  | { id: string; type: "button"; label: LocalizedText; href: string }
  | { id: string; type: "columns"; left: LocalizedText; right: LocalizedText }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size: "s" | "m" | "l" };

/** Le corps par defaut : ce que rend un modele qui n'a rien compose. */
export const DEFAULT_BLOCKS: EmailBlock[] = [{ id: "message", type: "message" }];

const MAX_BLOCKS = 40;
const MAX_TEXT = 2000;
const MAX_LABEL = 80;

/** Une adresse ne part dans un courriel que si elle mene quelque part de sûr. */
export const safeUrl = (value: unknown): string | null => {
  const url = typeof value === "string" ? value.trim() : "";
  return url && /^(https?:\/\/|mailto:)[^\s<>"]+$/i.test(url) && url.length <= 500 ? url : null;
};

const localized = (value: unknown, max: number): LocalizedText => {
  const source = (value ?? {}) as Record<string, unknown>;
  const out: LocalizedText = {};
  for (const locale of LOCALES) {
    const text = source[locale];
    if (typeof text === "string" && text.trim()) out[locale] = text.trim().slice(0, max);
  }
  return out;
};

/** Le texte d'un bloc dans une langue, avec repli sur le francais. */
export const textIn = (value: LocalizedText, locale: Locale): string =>
  (value[locale] ?? value.fr ?? "").trim();

const identifier = (value: unknown, index: number): string => {
  const id = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : `b${index}`;
};

/**
 * Reconstruit la liste des blocs a partir de ce qui est stocke.
 *
 * ⚠️ **Au plus un bloc `message`.** Deux emplacements enverraient le texte
 * de la campagne deux fois ; zero le ferait disparaitre, donc il est ajoute
 * a la fin plutot que de perdre le message que quelqu'un vient d'ecrire.
 */
export function normalizeBlocks(value: unknown): EmailBlock[] {
  if (!Array.isArray(value)) return DEFAULT_BLOCKS;

  const blocks: EmailBlock[] = [];
  let seenMessage = false;

  for (const [index, raw] of value.slice(0, MAX_BLOCKS).entries()) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Record<string, unknown>;
    const id = identifier(source.id, index);
    const type = source.type;

    if (type === "greeting") {
      const named = localized(source.named, MAX_LABEL);
      const plain = localized(source.plain, MAX_LABEL);
      if (Object.keys(named).length || Object.keys(plain).length) {
        blocks.push({ id, type: "greeting", named, plain });
      }
    } else if (type === "signature") {
      const text = localized(source.text, MAX_TEXT);
      if (Object.keys(text).length) blocks.push({ id, type: "signature", text });
    } else if (type === "message") {
      if (seenMessage) continue;
      seenMessage = true;
      blocks.push({ id, type: "message" });
    } else if (type === "text") {
      const text = localized(source.text, MAX_TEXT);
      if (Object.keys(text).length) blocks.push({ id, type: "text", text });
    } else if (type === "image") {
      const src = safeUrl(source.src);
      // Une image sans adresse n'est pas un bloc, c'est un trou.
      if (src) {
        blocks.push({
          id,
          type: "image",
          src,
          alt: localized(source.alt, MAX_LABEL),
          href: safeUrl(source.href),
          width: source.width === "auto" ? "auto" : "full",
        });
      }
    } else if (type === "button") {
      const href = safeUrl(source.href);
      const label = localized(source.label, MAX_LABEL);
      if (href && Object.keys(label).length) blocks.push({ id, type: "button", label, href });
    } else if (type === "columns") {
      const left = localized(source.left, MAX_TEXT);
      const right = localized(source.right, MAX_TEXT);
      if (Object.keys(left).length || Object.keys(right).length) {
        blocks.push({ id, type: "columns", left, right });
      }
    } else if (type === "divider") {
      blocks.push({ id, type: "divider" });
    } else if (type === "spacer") {
      const size = source.size === "s" || source.size === "l" ? source.size : "m";
      blocks.push({ id, type: "spacer", size });
    }
    // Tout autre `type` est ignore : c'est la liste blanche.
  }

  if (!blocks.length) return DEFAULT_BLOCKS;
  // ⚠️ Le message doit avoir un endroit ou aller. Sans bloc `message`, le
  // texte de la campagne n'aurait nulle part ou se poser et disparaitrait
  // sans un mot — on le remet a la fin.
  if (!seenMessage) blocks.push({ id: "message", type: "message" });
  return blocks;
}
