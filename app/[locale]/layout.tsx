import type { Metadata } from "next";

import "../globals.css";
import { cn } from "@/lib/utils";
import { FONT_CLASSNAMES } from "@/lib/fonts";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LOCALE_DIR, LOCALES } from "@/lib/i18n/config";

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
    default: "Back-office — Ifriqiya Soccer Star",
    template: "%s — Ifriqiya Soccer Star",
  },
  description:
    "Back-office administrateur d'Ifriqiya Soccer Star : validations, moderation, Scout Days, abonnements et paiements.",
  // Repris tel quel par toute page qui ne definit pas son propre `openGraph`
  // (fusion superficielle de Next : cf. commentaire de `generateMetadata` dans
  // `app/[locale]/page.tsx`). Le site public precise `title`/`description`
  // **et** `images` par page (voir `page.tsx`, `blog/page.tsx`,
  // `contact/page.tsx`, `blog/[slug]/page.tsx`) : l'image de partage
  // (`public/og/{fr,en,ar}.png`) depend de la langue, donc ne peut pas vivre
  // ici. ⚠️ Ces chemins ne se resolvent en URL absolue — necessaire pour
  // qu'un client externe (WhatsApp, X...) recupere l'image — qu'avec
  // `metadataBase`, donc `NEXT_PUBLIC_SITE_URL` doit etre renseignee en
  // production.
  openGraph: { siteName: "Ifriqiya Soccer Star", type: "website" },
  twitter: { card: "summary_large_image" },
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
        FONT_CLASSNAMES,
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
