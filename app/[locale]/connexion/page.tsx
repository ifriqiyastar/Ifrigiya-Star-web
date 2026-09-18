import type { Metadata } from "next";

import { AuthShell } from "./auth-shell";
import { SignInForm } from "./sign-in-form";
import { getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { localePath } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAdminDict();
  return { title: dict.signIn.metaTitle };
}

/**
 * L'ecran de connexion suit la langue du **back-office**, pas celle du site
 * public : c'est sa porte d'entree, il n'est atteignable que depuis la garde
 * `requireAdmin()` ou la deconnexion, et `isAdminPath()` le fait donc traiter
 * comme `/admin` par le proxy — francais ou anglais, jamais arabe.
 */
export default async function ConnexionPage({
  searchParams,
}: PageProps<"/[locale]/connexion">) {
  const { erreur } = await searchParams;
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const d = dict.signIn;

  // Les trois causes de renvoi vers cet ecran, dites du point de vue de
  // l'utilisateur : aucune ne nomme de table ni de colonne, contrairement a
  // la premiere version.
  const errors: Record<string, string> = {
    "acces-refuse": d.errorAccessDenied,
    "compte-introuvable": d.errorNoProfile,
    "compte-desactive": d.errorDeactivated,
  };
  const message = typeof erreur === "string" ? errors[erreur] : undefined;

  return (
    <AuthShell
      locale={locale}
      chrome={{
        backToSite: d.backToSite,
        kicker: d.kicker,
        heroKicker: d.heroKicker,
        heroTitle: d.heroTitle,
        heroAccent: d.heroAccent,
        heroDescription: d.heroDescription,
      }}
      card={{
        titleId: "sign-in-title",
        kicker: d.kicker,
        title: d.title,
        description: d.description,
        footer: d.footer,
      }}
    >
      <SignInForm
        initialError={message}
        adminHref={localePath(locale, "/admin")}
        forgotHref={localePath(locale, "/connexion/mot-de-passe-oublie")}
        language={locale}
        labels={{
          email: d.email,
          password: d.password,
          forgot: dict.passwordReset.link,
          submit: d.submit,
          pending: d.pending,
          invalid: d.invalid,
          showPassword: d.showPassword,
          hidePassword: d.hidePassword,
          captchaRequired: d.captchaRequired,
          captchaRejected: d.captchaRejected,
          captcha: {
            label: d.captchaLabel,
            loading: d.captchaLoading,
            failed: d.captchaFailed,
            retry: d.captchaRetry,
          },
        }}
      />
    </AuthShell>
  );
}
