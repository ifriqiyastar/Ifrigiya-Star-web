import { Heading, Link, Text } from "@react-email/components";

import type { RichDoc, RichNode } from "@/lib/rich-text/server";

/**
 * Le message d'une campagne, mis en forme, rendu en composants d'e-mail.
 *
 * ⚠️ **Rien n'est emis en HTML brut.** Ce fichier parcourt l'arbre rendu par
 * `parseRichText()` — deja valide contre le schema Tiptap — et construit des
 * elements React. Un type de noeud ou une marque inconnue n'a pas de branche
 * ici : son **texte** est rendu, sa mise en forme est perdue. C'est
 * volontaire : une liste blanche qui se trompe rend un message terne, une
 * liste noire qui se trompe envoie une injection.
 *
 * ⚠️ **Le `href` est revalide ici**, alors que le schema l'a deja filtre.
 * Deux gardes valent mieux qu'une quand la sortie part chez des milliers de
 * personnes, et celle-ci est une ligne.
 */
export function RichBody({
  doc,
  color,
  align,
  fontFamily,
  linkColor,
}: {
  doc: RichDoc;
  color: string;
  align: "left" | "right";
  fontFamily: string;
  linkColor: string;
}) {
  const paragraph = {
    color,
    fontFamily,
    fontSize: "15px",
    lineHeight: "1.65",
    margin: "0 0 12px",
    textAlign: align,
  } as const;

  const safeHref = (value: unknown) => {
    const href = typeof value === "string" ? value.trim() : "";
    return /^(https?:\/\/|mailto:)/i.test(href) ? href : null;
  };

  /** Les marques d'un fragment de texte : gras, italique, lien, couleur. */
  const renderText = (node: RichNode, key: React.Key): React.ReactNode => {
    let content: React.ReactNode = node.text ?? "";
    let style: React.CSSProperties = {};

    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") style = { ...style, fontWeight: 700 };
      else if (mark.type === "italic") style = { ...style, fontStyle: "italic" };
      else if (mark.type === "strike") style = { ...style, textDecoration: "line-through" };
      else if (mark.type === "underline") style = { ...style, textDecoration: "underline" };
      else if (mark.type === "code") {
        style = { ...style, fontFamily: "Consolas, Menlo, monospace", fontSize: "14px" };
      } else if (mark.type === "textStyle" && typeof mark.attrs?.color === "string") {
        // La couleur vient du selecteur de l'editeur : Tiptap ne conserve
        // qu'une valeur de couleur, mais on la borne quand meme.
        const value = mark.attrs.color.trim();
        if (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(value)) {
          style = { ...style, color: value };
        }
      }
    }

    const link = (node.marks ?? []).find((mark) => mark.type === "link");
    const href = link ? safeHref(link.attrs?.href) : null;
    if (href) {
      content = (
        <Link href={href} style={{ color: linkColor, textDecoration: "underline", ...style }}>
          {content}
        </Link>
      );
      return <span key={key}>{content}</span>;
    }

    return Object.keys(style).length ? (
      <span key={key} style={style}>
        {content}
      </span>
    ) : (
      <span key={key}>{content}</span>
    );
  };

  const renderInline = (nodes: RichNode[] | undefined): React.ReactNode =>
    (nodes ?? []).map((node, index) =>
      node.type === "text" ? (
        renderText(node, index)
      ) : node.type === "hardBreak" ? (
        <br key={index} />
      ) : (
        <span key={index}>{renderInline(node.content)}</span>
      ),
    );

  const renderBlocks = (nodes: RichNode[] | undefined): React.ReactNode =>
    (nodes ?? []).map((node, index) => {
      if (node.type === "heading") {
        const level = node.attrs?.level === 3 ? 3 : 2;
        return (
          <Heading
            key={index}
            as={level === 3 ? "h3" : "h2"}
            style={{
              color,
              fontFamily,
              fontSize: level === 3 ? "16px" : "18px",
              fontWeight: 700,
              lineHeight: "1.3",
              margin: "18px 0 8px",
              textAlign: align,
            }}
          >
            {renderInline(node.content)}
          </Heading>
        );
      }

      if (node.type === "bulletList" || node.type === "orderedList") {
        const ordered = node.type === "orderedList";
        const Tag = ordered ? "ol" : "ul";
        return (
          // ⚠️ Marge laterale explicite des deux cotes : les clients de
          // messagerie n'ont pas la meme marge par defaut sur les listes, et
          // en lecture de droite a gauche elle doit changer de cote.
          <Tag
            key={index}
            style={{
              color,
              fontFamily,
              fontSize: "15px",
              lineHeight: "1.65",
              margin: "0 0 12px",
              paddingLeft: align === "left" ? "22px" : 0,
              paddingRight: align === "right" ? "22px" : 0,
              textAlign: align,
            }}
          >
            {(node.content ?? []).map((item, itemIndex) => (
              <li key={itemIndex} style={{ marginBottom: "4px" }}>
                {renderInline(item.content?.flatMap((child) => child.content ?? []) ?? [])}
              </li>
            ))}
          </Tag>
        );
      }

      // Tout le reste — paragraphe compris — se lit comme un paragraphe.
      const inline = renderInline(node.content);
      return (
        <Text key={index} style={paragraph}>
          {inline}
        </Text>
      );
    });

  return <>{renderBlocks(doc.content)}</>;
}
