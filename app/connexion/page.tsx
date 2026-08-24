import type { Metadata } from "next";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion" };

const ERREURS: Record<string, string> = {
  "acces-refuse":
    "Ce compte existe mais n'a pas le role administrateur. Le back-office est reserve aux comptes dont profiles.role vaut « admin ».",
  "compte-introuvable":
    "Aucune fiche profil n'est associee a cette session. Le compte a probablement ete supprime : reconnectez-vous.",
  "compte-desactive": "Ce compte administrateur est desactive.",
};

export default async function ConnexionPage({
  searchParams,
}: PageProps<"/connexion">) {
  const { erreur } = await searchParams;
  const message = typeof erreur === "string" ? ERREURS[erreur] : undefined;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand font-heading text-lg font-extrabold text-brand-foreground">
            IS
          </span>
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-extrabold tracking-wide">IFRIQIYA STAR</h1>
            <p className="text-[0.625rem] font-semibold tracking-[0.2em] text-brand uppercase">
              Back-office administrateur
            </p>
          </div>
        </div>

        <SignInForm initialError={message} />

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Meme base d&apos;utilisateurs que l&apos;application mobile. Seuls les
          comptes administrateur peuvent acceder a cet espace.
        </p>
      </div>
    </div>
  );
}
