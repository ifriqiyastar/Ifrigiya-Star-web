import { Nunito_Sans, Poppins } from "next/font/google";

/**
 * Typographie de marque, identique a l'app mobile (`BrandFonts` dans
 * `src/constants/theme.ts` d'ifriqiyastar) : Nunito Sans pour les titres,
 * Poppins pour le corps de texte.
 *
 * Les deux polices embarquent le sous-ensemble arabe en plus du latin : sans
 * lui, une page en arabe retomberait sur la police systeme et perdrait la
 * charte. Poppins n'ayant pas de glyphes arabes, c'est Nunito Sans — puis le
 * repli systeme — qui rend le texte arabe.
 *
 * DECLAREES ICI, ET PAS DANS LA MISE EN PAGE, parce qu'elles ont deux
 * appelants : `app/[locale]/layout.tsx` et `app/global-not-found.tsx`, qui
 * court-circuite justement la mise en page et doit donc importer lui-meme ses
 * polices. Deux declarations `next/font` separees produiraient deux
 * telechargements et, surtout, deux valeurs de `--font-sans` qui finiraient
 * par diverger.
 */
export const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

/** Les classes a poser sur `<html>` : les deux variables, plus la police par defaut. */
export const FONT_CLASSNAMES = `${poppins.variable} ${nunitoSans.variable} font-sans`;
