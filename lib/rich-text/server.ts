import "server-only";

import { generateJSON } from "@tiptap/html/server";

import { RICH_TEXT_EXTENSIONS } from "./extensions";

/** Un noeud de l'arbre ProseMirror, tel que le schema le rend. */
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};

export type RichDoc = { type: "doc"; content?: RichNode[] };

/**
 * Le HTML du navigateur, ramene a l'arbre que le schema autorise.
 *
 * ⚠️ **Le seul point d'entree du HTML dans le courriel.** Tout ce qui sort
 * d'ici a ete valide par ProseMirror contre `RICH_TEXT_EXTENSIONS` ; le
 * rendu (`emails/rich-body.tsx`) ne fait que parcourir cet arbre et emettre
 * des composants React. A aucun moment une chaine fournie par le client
 * n'est posee comme du HTML.
 *
 * Rend `null` sur un contenu vide ou illisible : l'appelant retombe alors
 * sur le texte brut, qui existe toujours.
 */
export function parseRichText(html: string | null | undefined): RichDoc | null {
  const clean = (html ?? "").trim();
  if (!clean) return null;
  try {
    const doc = generateJSON(clean, RICH_TEXT_EXTENSIONS) as RichDoc;
    if (!doc?.content?.length) return null;
    // ⚠️ Un editeur vide rend `<p></p>`, donc un document d'**un paragraphe
    // sans texte** : compter les noeuds ne suffit pas. Si rien ne se lit, il
    // n'y a rien a rendre, et l'appelant retombe sur la saisie brute.
    return richToPlainText(doc) ? doc : null;
  } catch {
    return null;
  }
}

/**
 * Le texte brut correspondant a l'arbre.
 *
 * ⚠️ C'est lui qui part dans la notification in-app et dans le push : un
 * ecran verrouille ne rend pas `<strong>`. Il est **derive** du message mis
 * en forme plutot que saisi a part, pour que les deux ne puissent pas
 * raconter deux choses differentes.
 *
 * Les elements de liste recoivent un tiret : sans lui, « un deux trois »
 * se lit comme une phrase.
 */
export function richToPlainText(doc: RichDoc | null): string {
  if (!doc) return "";
  const lines: string[] = [];

  const textOf = (nodes: RichNode[] | undefined): string =>
    (nodes ?? [])
      .map((node) => (node.type === "text" ? (node.text ?? "") : textOf(node.content)))
      .join("");

  const walk = (nodes: RichNode[] | undefined, bullet: string) => {
    for (const node of nodes ?? []) {
      if (node.type === "bulletList" || node.type === "orderedList") {
        walk(node.content, node.type === "bulletList" ? "— " : "");
        continue;
      }
      if (node.type === "listItem") {
        const text = textOf(node.content).trim();
        if (text) lines.push(`${bullet}${text}`);
        continue;
      }
      const text = textOf(node.content).trim();
      if (text) lines.push(text);
    }
  };

  walk(doc.content, "");
  return lines.join("\n").trim();
}
