import { Nunito_Sans, Poppins } from "next/font/google";
import type { Metadata } from "next";

import "../globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LOCALE_DIR, LOCALES } from "@/lib/i18n/config";

/**
 * Typographie de marque, identique a l'app mobile (`BrandFonts` dans
 * `src/constants/theme.ts` d'ifriqiyastar) : Nunito Sans pour les titres,
 * Poppins pour le corps de texte.
 *
 * Les deux polices embarquent le sous-ensemble arabe en plus du latin : sans
 * lui, une page en arabe retomberait sur la police systeme et perdrait la
 * charte. Poppins n'ayant pas de glyphes arabes, c'est Nunito Sans — puis le
 * repli systeme — qui rend le texte arabe.
 */
const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

/**
 * `hreflang` et `canonical` doivent etre des URL **absolues** pour que Google
 * les prenne en compte ; sans `metadataBase` Next les rend relatives. Le
 * domaine de production n'etant pas connu de ce depot, il vient d'une
 * variable d'environnement optionnelle : absente, on retombe sur le
 * comportement actuel (liens relatifs) plutot que d'inventer une adresse.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "Back-office — Ifriqiya Star",
    template: "%s — Ifriqiya Star",
  },
  description:
    "Back-office administrateur d'Ifriqiya Star : validations, moderation, Scout Days, abonnements et paiements.",
};

/**
 * Les trois langues sont connues a l'avance, donc pre-rendues. Sans cela le
 * segment `[locale]` forcerait un rendu dynamique sur la page d'accueil, qui
 * est aujourd'hui statique.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html
      lang={locale}
      // `dir` porte tout le miroitage : les utilitaires logiques de Tailwind
      // (`ms-`, `pe-`, `text-start`, `start-0`) se resolvent a partir de lui.
      dir={LOCALE_DIR[locale]}
      // Le back-office reprend le theme sombre de l'app mobile (fond noir,
      // accent lime). Les tokens clairs restent definis dans globals.css.
      className={cn(
        "dark h-full",
        "antialiased",
        poppins.variable,
        nunitoSans.variable,
        "font-sans",
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <I18nProvider locale={locale} dict={dict}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </I18nProvider>
      </body>
    </html>
  );
}
