import type { Metadata } from "next";
import { Nunito_Sans, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Typographie de marque, identique a l'app mobile (`BrandFonts` dans
 * `src/constants/theme.ts` d'ifriqiyastar) : Nunito Sans pour les titres,
 * Poppins pour le corps de texte.
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

export const metadata: Metadata = {
  title: {
    default: "Back-office — Ifriqiya Star",
    template: "%s — Ifriqiya Star",
  },
  description:
    "Back-office administrateur d'Ifriqiya Star : validations, moderation, Scout Days, abonnements et paiements.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
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
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
