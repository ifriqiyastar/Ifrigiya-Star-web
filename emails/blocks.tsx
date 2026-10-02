import * as React from "react";
import { Column, Heading, Hr, Img, Link, Row, Section, Text } from "@react-email/components";

import { RichBody } from "./rich-body";
import { textIn, type EmailBlock } from "@/lib/email/blocks";
import { NAME_TOKEN } from "./copy";
import type { Locale } from "@/lib/i18n/config";
import type { RichDoc } from "@/lib/rich-text/server";

/**
 * Le corps compose d'un modele, rendu en composants d'e-mail.
 *
 * ⚠️ **Un `switch` sur un type connu, et rien d'autre.** Chaque branche
 * ecrit son propre balisage ; aucune valeur venue de la base n'est jamais
 * posee comme du HTML. C'est ce qui permet de laisser un non-technicien
 * composer librement : il choisit l'ordre des blocs, pas leur rendu.
 *
 * ⚠️ **Tout passe par des tableaux.** Pas de flexbox ni de grille : `Row` et
 * `Column` de React Email compilent en `<table>`, parce que c'est ce
 * qu'Outlook sait faire. Une colonne ecrite en CSS s'empilerait chez lui.
 */
export function EmailBlocks({
  blocks,
  locale,
  align,
  colors,
  fonts,
  message,
  recipientName,
}: {
  blocks: EmailBlock[];
  locale: Locale;
  align: "left" | "right";
  colors: { text: string; buttonBg: string; buttonText: string };
  fonts: { body: string; heading: string };
  /** Ce que le bloc `message` doit rendre : le titre et le texte de la campagne. */
  message: { title: string; doc: RichDoc | null; paragraphs: string[] };
  /** Le nom du destinataire, pour la formule d'accueil. */
  recipientName?: string | null;
}) {
  const paragraphStyle = {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: "15px",
    lineHeight: "1.65",
    margin: "0 0 12px",
    textAlign: align,
  } as const;

  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "greeting": {
            const name = recipientName?.trim();
            const line = name
              ? textIn(block.named, locale).replaceAll(NAME_TOKEN, name)
              : textIn(block.plain, locale);
            if (!line) return null;
            return (
              <Text
                key={block.id}
                style={{ ...paragraphStyle, color: "#6b6b6b", fontSize: "14px" }}
              >
                {line}
              </Text>
            );
          }

          case "signature": {
            const value = textIn(block.text, locale);
            if (!value) return null;
            return (
              <Text
                key={block.id}
                style={{ ...paragraphStyle, color: "#6b6b6b", whiteSpace: "pre-line" }}
              >
                {value}
              </Text>
            );
          }

          case "message":
            return (
              <React.Fragment key={block.id}>
                {/* ⚠️ Le **titre** appartient au bloc message, pas a l'ossature
                    fixe. Sans cela, une formule d'accueil posee en bloc
                    tomberait forcement sous le titre, et l'ordre ne serait
                    libre qu'a moitie. */}
                {message.title ? (
                  <Heading
                    as="h1"
                    style={{
                      color: colors.text,
                      fontFamily: fonts.heading,
                      fontSize: "22px",
                      fontWeight: 800,
                      lineHeight: "1.25",
                      margin: "0 0 16px",
                      textAlign: align,
                    }}
                  >
                    {message.title}
                  </Heading>
                ) : null}
                {message.doc ? (
                  <RichBody
                    doc={message.doc}
                    color={colors.text}
                    align={align}
                    fontFamily={fonts.body}
                    linkColor={colors.buttonBg}
                  />
                ) : (
                  message.paragraphs.map((line, index) => (
                    <Text key={index} style={paragraphStyle}>
                      {line}
                    </Text>
                  ))
                )}
              </React.Fragment>
            );

          case "text": {
            const value = textIn(block.text, locale);
            if (!value) return null;
            // Les sauts de ligne de la saisie deviennent des paragraphes :
            // du texte brut s'afficherait autrement sur une seule ligne.
            return (
              <React.Fragment key={block.id}>
                {value
                  .split(/\n+/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => (
                    <Text key={index} style={paragraphStyle}>
                      {line}
                    </Text>
                  ))}
              </React.Fragment>
            );
          }

          case "image": {
            // ⚠️ Deux traitements, parce qu'une image de courriel est soit
            // une photo, soit un pictogramme. En `full`, l'attribut `width`
            // **et** le style sont necessaires : sans l'attribut Outlook
            // rend la taille native, sans le style l'image deborde sur un
            // telephone. En `auto`, aucune largeur n'est imposee — etirer un
            // petit visuel a 552 px le rend flou et ridicule, ce que la
            // premiere version faisait sans le demander.
            const full = block.width !== "auto";
            const image = (
              <Img
                src={block.src}
                alt={textIn(block.alt, locale)}
                {...(full ? { width: "552" } : {})}
                style={
                  full
                    ? { display: "block", height: "auto", maxWidth: "100%", width: "100%" }
                    : { display: "block", height: "auto", maxWidth: "100%" }
                }
              />
            );
            return (
              <Section key={block.id} style={{ margin: "0 0 16px" }}>
                {block.href ? <Link href={block.href}>{image}</Link> : image}
              </Section>
            );
          }

          case "button": {
            const label = textIn(block.label, locale);
            if (!label) return null;
            return (
              <Section key={block.id} style={{ margin: "4px 0 20px", textAlign: align }}>
                <Link
                  href={block.href}
                  style={{
                    backgroundColor: colors.buttonBg,
                    borderRadius: "8px",
                    color: colors.buttonText,
                    display: "inline-block",
                    fontFamily: fonts.body,
                    fontSize: "14px",
                    fontWeight: 700,
                    padding: "12px 22px",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              </Section>
            );
          }

          case "columns": {
            // ⚠️ En lecture de droite a gauche, la colonne « gauche » du
            // formulaire doit se rendre a droite : c'est l'ordre de lecture
            // qui compte, pas le nom du champ.
            const first = textIn(align === "right" ? block.right : block.left, locale);
            const second = textIn(align === "right" ? block.left : block.right, locale);
            return (
              <Row key={block.id} style={{ margin: "0 0 12px" }}>
                <Column style={{ paddingRight: "8px", verticalAlign: "top", width: "50%" }}>
                  <Text style={paragraphStyle}>{first}</Text>
                </Column>
                <Column style={{ paddingLeft: "8px", verticalAlign: "top", width: "50%" }}>
                  <Text style={paragraphStyle}>{second}</Text>
                </Column>
              </Row>
            );
          }

          case "divider":
            return <Hr key={block.id} style={{ borderColor: "#e5e5e5", margin: "20px 0" }} />;

          case "spacer":
            return (
              <Section
                key={block.id}
                style={{ height: block.size === "s" ? "8px" : block.size === "l" ? "40px" : "20px" }}
              />
            );
        }
      })}
    </>
  );
}

