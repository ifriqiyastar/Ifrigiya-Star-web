import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reinitialisation du mot de passe (§4.1), **par code a six chiffres** et non
 * par lien clicable — le meme mecanisme que l'app mobile
 * (`~/ifriqiyastar/src/lib/password-reset.ts`), dont ce fichier est le
 * portage.
 *
 * `resetPasswordForEmail()` envoie le gabarit « Reset Password » de Supabase,
 * qui peut porter deux choses : `{{ .ConfirmationURL }}`, un lien, et
 * `{{ .Token }}`, un code. C'est le **code** qui est utilise, pour une raison
 * qui tient au projet partage et pas au support : le gabarit est **commun a
 * l'app mobile et a ce back-office** (un seul projet Supabase, un seul
 * gabarit), et l'app mobile, elle, n'a pas de site vers lequel un lien
 * reviendrait. Un gabarit reecrit en lien ferait donc atterrir tous les
 * joueurs sur une page web au lieu de leur application.
 *
 * ⚠️ **Deux reglages du tableau de bord conditionnent tout ce fichier**, et
 * aucun ne se detecte depuis le code :
 *
 *  1. **Authentication → Emails → Reset Password** doit contenir
 *     `{{ .Token }}`. Le gabarit livre par defaut ne porte que le lien : sans
 *     cette modification, l'e-mail arrive **sans code** et l'utilisateur
 *     attend quelque chose qui ne viendra jamais.
 *  2. **Authentication → SMTP Settings** doit porter un fournisseur a nous
 *     (Resend, Brevo, Mailgun, SES…). Le serveur integre de Supabase est
 *     limite a quelques envois par heure **et ne delivre qu'aux adresses des
 *     membres du projet** — d'ou `email_address_not_authorized`, nomme
 *     explicitement plus bas plutot que rendu comme une panne.
 *
 * Le client Supabase est **passe en parametre** plutot qu'importe : l'ecran
 * « mot de passe oublie » appelle avec le client navigateur, et le geste
 * d'administration « envoyer un lien de reinitialisation » avec le client
 * `service_role`, qui lui a le droit de sauter le defi anti-robot (voir
 * `sendPasswordReset()` dans `lib/actions/users.ts`). Les deux partagent alors
 * exactement la meme lecture des erreurs.
 */

/**
 * Longueur minimale d'un mot de passe — la meme que celle de l'app mobile, les
 * deux depots ecrivant dans le meme GoTrue.
 *
 * ⚠️ **Ce nombre doit rester ≥ au minimum du tableau de bord** (Authentication
 * → Providers → Minimum password length). Plus strict que le serveur est sans
 * danger ; l'inverse fait refuser par GoTrue un mot de passe que l'ecran vient
 * d'accepter.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Nombre de chiffres du code recu par e-mail, et donc de cases du pave de
 * saisie (`OtpInput`).
 *
 * ⚠️ **Ce nombre doit valoir `mailer_otp_length`** (Supabase → Authentication
 * → Providers → Email). 6 est le defaut de GoTrue. Un pave plus court que le
 * code est infranchissable, et **rien dans l'application ne peut le
 * detecter** : le serveur ne publie pas ce reglage.
 */
export const OTP_LENGTH = 6;

/** Attente imposee avant de pouvoir redemander un code. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Motif d'echec, dans la meme veine que les `hint` des RPC de ce projet : le
 * code est lisible par la machine, la phrase francaise vit dans le
 * dictionnaire (`passwordReset.failures`).
 */
export type ResetFailure =
  | "rate_limited"
  | "smtp_unconfigured"
  | "send_failed"
  | "invalid_email"
  | "invalid_code"
  /** Le defi anti-robot a ete refuse — jeton absent, perime ou deja consomme. */
  | "captcha_failed"
  | "same_password"
  | "weak_password"
  | "unknown";

export type ResetError = {
  reason: ResetFailure;
  /**
   * Le message brut de Supabase, `code`/`status` compris. C'est la seule
   * partie qui identifie la cause reelle pour qui exploite l'application —
   * elle va dans la console ou dans un `ActionResult`, jamais dans la phrase
   * montree a l'utilisateur qui attend un e-mail.
   */
  detail: string;
};

function detailOf(error: unknown): string {
  const source = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const parts = [
    typeof source?.message === "string" ? source.message : "",
    typeof source?.code === "string" ? `code=${source.code}` : "",
    typeof source?.status === "number" ? `status=${source.status}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : String(error);
}

function failure(reason: ResetFailure, error: unknown): ResetError {
  return { reason, detail: detailOf(error) };
}

function codeOf(error: unknown): string {
  const source = error as { code?: unknown } | null;
  return typeof source?.code === "string" ? source.code : "";
}

function statusOf(error: unknown): number | undefined {
  const source = error as { status?: unknown } | null;
  return typeof source?.status === "number" ? source.status : undefined;
}

/**
 * Un refus du defi anti-robot. Le `code` est la voie normale, le message n'est
 * regarde qu'a defaut — meme repli textuel assume que `isCaptchaFailure()`
 * dans le formulaire de connexion : confondre « refais le defi » avec
 * « l'e-mail n'est pas parti » envoie l'utilisateur attendre un message qui ne
 * viendra jamais.
 */
function isCaptchaFailure(error: unknown): boolean {
  if (codeOf(error) === "captcha_failed") return true;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && /captcha/i.test(message);
}

/**
 * Demande l'envoi d'un code. Renvoie `null` en cas de succes.
 *
 * ⚠️ **Un succes ne dit pas qu'un compte existe**, et l'interface ne doit
 * jamais l'affirmer : Supabase repond volontairement de la meme facon pour une
 * adresse inconnue (anti-enumeration de comptes). D'ou la formulation de
 * l'ecran suivant, « si un compte existe a cette adresse ».
 */
export async function requestPasswordReset(
  supabase: SupabaseClient,
  email: string,
  /**
   * Le jeton Turnstile, quand la protection anti-robot est active sur le
   * projet (Authentication → Attack Protection). `null`/absent quand elle ne
   * l'est pas — GoTrue ignore alors le champ —, et absent aussi quand
   * l'appelant est le client `service_role`, que GoTrue dispense du defi.
   *
   * ⚠️ **Un jeton ne sert qu'une fois** : l'appelant doit en produire un neuf
   * a chaque envoi, y compris pour un simple « Renvoyer ».
   */
  captchaToken?: string | null,
): Promise<ResetError | null> {
  // Aucun `redirectTo` : c'est le code que l'on attend, pas le lien.
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    captchaToken: captchaToken ?? undefined,
  });
  if (!error) return null;

  const code = codeOf(error);
  const status = statusOf(error);

  if (isCaptchaFailure(error)) return failure("captcha_failed", error);
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || status === 429) {
    return failure("rate_limited", error);
  }
  // Le serveur SMTP integre n'accepte que les adresses de l'equipe du projet :
  // ce n'est pas une panne, c'est une configuration qui manque.
  if (code === "email_address_not_authorized") return failure("smtp_unconfigured", error);
  if (code === "validation_failed" || code === "email_address_invalid") {
    return failure("invalid_email", error);
  }
  // `unexpected_failure` sur cet appel designe presque toujours l'envoi
  // lui-meme (SMTP absent ou refuse par le fournisseur).
  if (code === "unexpected_failure" || status === 500) return failure("send_failed", error);
  return failure("unknown", error);
}

/**
 * Echange le code contre une session. C'est cette session — et rien d'autre —
 * qui autorise ensuite `updateUser({ password })`.
 *
 * **Aucun jeton anti-robot ici, et c'est volontaire** : GoTrue protege les
 * points d'entree qui *declenchent* un envoi ou creent une session a partir de
 * rien (`/signup`, `/token`, `/recover`), pas la verification d'un code deja
 * envoye — laquelle est de toute facon bornee par la duree de vie du code.
 *
 * Un code faux et un code perime rendent **tous deux** `otp_expired` cote
 * Supabase (« Token has expired or is invalid »), donc les deux cas partagent
 * un seul motif et une seule phrase : la distinction n'existe pas cote serveur
 * et l'inventer cote client tromperait l'utilisateur.
 */
export async function verifyResetCode(
  supabase: SupabaseClient,
  email: string,
  code: string,
): Promise<ResetError | null> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "recovery",
  });
  if (!error) return null;

  const reason = codeOf(error);
  if (reason === "over_email_send_rate_limit" || reason === "over_request_rate_limit" || statusOf(error) === 429) {
    return failure("rate_limited", error);
  }
  if (reason === "otp_expired" || reason === "otp_disabled" || reason === "invalid_credentials") {
    return failure("invalid_code", error);
  }
  return failure("unknown", error);
}

/** Ecrit le nouveau mot de passe sur la session ouverte par `verifyResetCode`. */
export async function applyNewPassword(
  supabase: SupabaseClient,
  password: string,
): Promise<ResetError | null> {
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return null;

  const reason = codeOf(error);
  if (reason === "same_password") return failure("same_password", error);
  if (reason === "weak_password") return failure("weak_password", error);
  return failure("unknown", error);
}
