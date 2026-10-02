import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";

/**
 * Le vocabulaire autorise dans le message d'une campagne.
 *
 * ⚠️ **C'est une liste blanche, et c'est ce qui rend le message riche sur.**
 * Le HTML saisi dans le navigateur repasse cote serveur par ce meme schema
 * (`parseRichText`), et ProseMirror **jette** tout ce qu'il ne connait pas.
 * Mesure contre ces extensions exactement : `<script>`, `<iframe>`,
 * `<img onerror>`, `style=`, `class=`, `onclick=` et un lien `javascript:`
 * ne survivent pas — seul leur texte reste. Le courriel est ensuite
 * reconstruit a partir de l'arbre, jamais par concatenation de HTML.
 *
 * Ce module est **isomorphe** a dessein : l'editeur du navigateur et
 * l'analyse du serveur doivent partager exactement le meme schema. Deux
 * listes divergentes, et le serveur jetterait une mise en forme que
 * l'administrateur voit a l'ecran.
 */
export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({
    // Ce qu'un courriel ne doit pas porter : des titres de niveau 1 (le sujet
    // joue ce role), des images (hebergement, blocage, poids) et des blocs de
    // code, qui n'ont aucun sens dans une annonce.
    heading: { levels: [2, 3] },
    codeBlock: false,
    horizontalRule: false,
    blockquote: false,
    link: {
      openOnClick: false,
      // `autolink` transformerait une adresse tapee par megarde en lien.
      autolink: false,
      protocols: ["http", "https", "mailto"],
    },
  }),
  TextStyle,
  Color,
];
