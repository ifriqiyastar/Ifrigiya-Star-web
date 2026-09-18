import type { Metadata } from "next";

import { AuthShell } from "../auth-shell";
import { ResetPasswordForm } from "./reset-form";
import { getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { localePath } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAdminDict();
  return { title: dict.passwordReset.metaTitle };
}

/**
 * §4.1 — « mot de passe oublie », cote web.
 *
 * L'ecran est une **sous-route de `/connexion`** et non une route a part : il
 * herite ainsi de la regle de langue du back-office (`isAdminPath()` couvre
 * `/connexion/...`), et l'adresse dit d'ou l'on vient et ou l'on retourne.
 *
 * Tout le geste est client — trois etapes, un code consomme en chemin — donc
 * la carte laisse son en-tete au formulaire : il change a chaque etape, et un
 * titre rendu ici resterait fige sur celui de la premiere.
 */
export default async function MotDePasseOubliePage() {
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const d = dict.passwordReset;

  return (
    <AuthShell
      locale={locale}
      chrome={{
        backToSite: dict.signIn.backToSite,
        kicker: dict.signIn.kicker,
        heroKicker: dict.signIn.heroKicker,
        heroTitle: dict.signIn.heroTitle,
        heroAccent: dict.signIn.heroAccent,
        heroDescription: dict.signIn.heroDescription,
      }}
      card={{
        titleId: "reset-title",
        footer: d.footer,
        back: { href: localePath(locale, "/connexion"), label: d.backToSignIn },
      }}
    >
      <ResetPasswordForm
        signInHref={localePath(locale, "/connexion")}
        language={locale}
        labels={{
          step: d.step,
          emailTitle: d.emailTitle,
          emailDescription: d.emailDescription,
          emailLabel: d.emailLabel,
          emailRequired: d.emailRequired,
          emailInvalid: d.emailInvalid,
          sendCode: d.sendCode,
          sending: d.sending,
          codeTitle: d.codeTitle,
          codeDescription: d.codeDescription,
          codeLabel: d.codeLabel,
          codeHint: d.codeHint,
          codeIncomplete: d.codeIncomplete,
          verify: d.verify,
          verifying: d.verifying,
          resend: d.resend,
          resendIn: d.resendIn,
          resent: d.resent,
          passwordTitle: d.passwordTitle,
          passwordDescription: d.passwordDescription,
          passwordLabel: d.passwordLabel,
          confirmLabel: d.confirmLabel,
          passwordHint: d.passwordHint,
          passwordRequired: d.passwordRequired,
          passwordTooShort: d.passwordTooShort,
          confirmRequired: d.confirmRequired,
          passwordMismatch: d.passwordMismatch,
          save: d.save,
          saving: d.saving,
          doneTitle: d.doneTitle,
          doneDescription: d.doneDescription,
          signIn: d.signIn,
          showPassword: dict.signIn.showPassword,
          hidePassword: dict.signIn.hidePassword,
          captchaRequired: dict.signIn.captchaRequired,
          failures: d.failures,
        }}
        captchaLabels={{
          label: dict.signIn.captchaLabel,
          loading: dict.signIn.captchaLoading,
          failed: dict.signIn.captchaFailed,
          retry: dict.signIn.captchaRetry,
        }}
      />
    </AuthShell>
  );
}
