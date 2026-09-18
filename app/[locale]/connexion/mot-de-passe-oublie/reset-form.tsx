"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  LockKeyholeIcon,
  MailIcon,
} from "lucide-react";

import { Captcha, useCaptcha, type CaptchaLabels } from "@/components/captcha";
import { OtpInput } from "@/components/otp-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fill } from "@/lib/i18n/admin-shared";
import {
  applyNewPassword,
  OTP_LENGTH,
  PASSWORD_MIN_LENGTH,
  requestPasswordReset,
  RESEND_COOLDOWN_SECONDS,
  verifyResetCode,
  type ResetFailure,
} from "@/lib/password-reset";
import { createClient } from "@/lib/supabase/client";

export type PasswordResetLabels = {
  step: string;
  emailTitle: string;
  emailDescription: string;
  emailLabel: string;
  emailRequired: string;
  emailInvalid: string;
  sendCode: string;
  sending: string;
  codeTitle: string;
  codeDescription: string;
  codeLabel: string;
  codeHint: string;
  codeIncomplete: string;
  verify: string;
  verifying: string;
  resend: string;
  resendIn: string;
  resent: string;
  passwordTitle: string;
  passwordDescription: string;
  passwordLabel: string;
  confirmLabel: string;
  passwordHint: string;
  passwordRequired: string;
  passwordTooShort: string;
  confirmRequired: string;
  passwordMismatch: string;
  save: string;
  saving: string;
  doneTitle: string;
  doneDescription: string;
  signIn: string;
  showPassword: string;
  hidePassword: string;
  captchaRequired: string;
  failures: Record<ResetFailure, string>;
};

/** Le meme controle qu'a l'inscription mobile : les deux doivent accepter
 *  exactement les memes adresses. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "email" | "code" | "password" | "done";

/**
 * §4.1 — la reinitialisation du mot de passe, en trois temps sur **un seul
 * ecran** : l'adresse, le code recu par e-mail, puis le nouveau mot de passe.
 *
 * Trois choses valent leur explication :
 *
 *  - **Un seul ecran, et non trois routes.** Le code est consomme des qu'il
 *    est verifie : un retour arriere du navigateur ramenerait sur une etape
 *    dont le geste n'a plus de sens. Un `step` en etat local ne se rejoue pas.
 *  - **Le code n'est echange qu'une fois.** `verifyResetCode` le consomme ; si
 *    l'ecriture du mot de passe echoue ensuite (« doit etre different de
 *    l'ancien »), la seconde tentative repart de l'ecriture seule, sans
 *    redemander un e-mail pour un simple choix de mot de passe.
 *  - **On se deconnecte apres avoir change le mot de passe.** `verifyOtp`
 *    *connecte* la personne — c'est ainsi que GoTrue autorise l'ecriture — et
 *    cette session-la n'a pas passe la garde `requireAdmin()`. On la ferme et
 *    on repasse par la connexion, seule porte d'entree du back-office.
 */
export function ResetPasswordForm({
  signInHref,
  language,
  labels,
  captchaLabels,
}: {
  /** L'ecran de connexion, deja prefixe de la langue. */
  signInHref: string;
  /** Langue du widget anti-robot : celle du back-office, `fr` ou `en`. */
  language: string;
  labels: PasswordResetLabels;
  captchaLabels: CaptchaLabels;
}) {
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [reveal, setReveal] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [notice, setNotice] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [fieldError, setFieldError] = React.useState<string | undefined>(undefined);
  const captcha = useCaptcha();

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  /**
   * ⚠️ `detail` est une trace de mise au point — elle va dans la console,
   * jamais a l'ecran : un `code`/`status` de Supabase n'apprend rien a qui
   * attend un code par e-mail.
   */
  function reportFailure(reason: ResetFailure, detail: string) {
    console.warn("[auth] reinitialisation refusee", reason, detail);
    setError(labels.failures[reason] ?? labels.failures.unknown);
  }

  /** Premier temps : l'adresse contre un envoi d'e-mail. */
  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError(labels.emailRequired);
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setFieldError(labels.emailInvalid);
      return;
    }
    // Le defi est exige ici pour ne pas gaspiller une tentative : sans jeton,
    // GoTrue refuserait de toute facon, mais avec son message anglais.
    if (captcha.enabled && !captcha.token) {
      setError(labels.captchaRequired);
      return;
    }

    setFieldError(undefined);
    setError(undefined);
    setPending(true);
    const failed = await requestPasswordReset(createClient(), trimmed, captcha.token);
    setPending(false);
    // ⚠️ Un jeton ne sert qu'une fois, y compris quand l'envoi a echoue.
    captcha.reset();
    if (failed) {
      reportFailure(failed.reason, failed.detail);
      return;
    }

    setEmail(trimmed);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("code");
  }

  /**
   * Deuxieme temps : le code contre une session.
   *
   * ⚠️ `submitted` n'est pas une commodite. Le pave verifie **tout seul** des
   * qu'il est rempli, et il appelle depuis le gestionnaire qui vient de poser
   * le dernier chiffre : a cet instant l'etat `code` porte encore la valeur
   * precedente. Lire `code` ici enverrait un code ampute de son dernier
   * chiffre — un refus incomprehensible, sur une saisie pourtant juste.
   */
  async function verify(submitted?: string) {
    const entered = (submitted ?? code).trim();
    if (entered.length < OTP_LENGTH) {
      setFieldError(fill(labels.codeIncomplete, { length: OTP_LENGTH }));
      return;
    }
    // ⚠️ Deux envois du meme code sont fatals : `verifyOtp` le CONSOMME, donc
    // le second echouerait sur un code devenu invalide et l'on lirait « code
    // expire » sur une saisie correcte. Le cas est reel depuis la verification
    // automatique — un clic sur « Verifier » pendant l'appel.
    if (pending) return;

    setFieldError(undefined);
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    const failed = await verifyResetCode(createClient(), email, entered);
    setPending(false);
    if (failed) {
      // Un code refuse est une erreur *de champ* autant qu'un message : la
      // ligne rouge dit ou corriger, l'encadre dit quoi.
      if (failed.reason === "invalid_code") setFieldError(labels.failures.invalid_code);
      reportFailure(failed.reason, failed.detail);
      return;
    }
    setStep("password");
  }

  /**
   * ⚠️ **Le renvoi rejoue `/recover`, donc il redemande un defi anti-robot** —
   * exactement comme le premier envoi. C'est la seule action de cette etape
   * qui en reclame un : la verification du code, elle, n'est pas protegee cote
   * GoTrue (voir `lib/password-reset.ts`).
   */
  async function resend() {
    if (captcha.enabled && !captcha.token) {
      setError(labels.captchaRequired);
      return;
    }
    setError(undefined);
    setNotice(undefined);
    setResending(true);
    const failed = await requestPasswordReset(createClient(), email, captcha.token);
    setResending(false);
    // ⚠️ Un jeton ne sert qu'une fois, y compris quand l'envoi a echoue.
    captcha.reset();
    if (failed) {
      reportFailure(failed.reason, failed.detail);
      return;
    }
    setCode("");
    setFieldError(undefined);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice(labels.resent);
  }

  /** Troisieme temps : le nouveau mot de passe, sur la session ci-dessus. */
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setFieldError(labels.passwordRequired);
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setFieldError(fill(labels.passwordTooShort, { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (!confirmPassword) {
      setFieldError(labels.confirmRequired);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError(labels.passwordMismatch);
      return;
    }

    setFieldError(undefined);
    setError(undefined);
    setPending(true);
    const supabase = createClient();
    const failed = await applyNewPassword(supabase, password);
    if (failed) {
      setPending(false);
      reportFailure(failed.reason, failed.detail);
      return;
    }

    // La session ouverte par le code s'arrete ici : elle n'a franchi aucune
    // garde d'administration, et le back-office n'a qu'une porte d'entree.
    await supabase.auth.signOut();
    setPending(false);
    setPassword("");
    setConfirmPassword("");
    setStep("done");
  }

  const stepNumber = step === "email" ? 1 : step === "code" ? 2 : 3;
  const heading =
    step === "email"
      ? { title: labels.emailTitle, description: labels.emailDescription }
      : step === "code"
        ? {
            title: labels.codeTitle,
            description: fill(labels.codeDescription, { email, length: OTP_LENGTH }),
          }
        : step === "password"
          ? { title: labels.passwordTitle, description: labels.passwordDescription }
          : { title: labels.doneTitle, description: labels.doneDescription };

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-brand uppercase">
          {step === "done" ? (
            <CheckIcon className="inline size-4" aria-hidden="true" />
          ) : (
            fill(labels.step, { current: stepNumber, total: 3 })
          )}
        </p>
        <h1 id="reset-title" className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
          {heading.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{heading.description}</p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-5" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">{labels.emailLabel}</Label>
            <div className="relative">
              <MailIcon
                className="pointer-events-none absolute start-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldError(undefined);
                }}
                placeholder="admin@ifriqiyastar.com"
                className="h-12 rounded-xl border-white/10 bg-white/5 ps-11 text-base placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-brand/15"
                aria-describedby={fieldError ? "reset-field-error" : undefined}
              />
            </div>
            <FieldError message={fieldError} />
          </div>

          <Captcha key={captcha.nonce} state={captcha} language={language} labels={captchaLabels} />

          <Notices error={error} notice={notice} />

          <Button type="submit" className="mt-2 h-12 w-full gap-3 rounded-xl text-sm shadow-lg shadow-brand/10" disabled={pending}>
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? labels.sending : labels.sendCode}
            {!pending ? <ArrowRightIcon className="size-4" aria-hidden="true" /> : null}
          </Button>
        </form>
      ) : null}

      {step === "code" ? (
        <div className="space-y-5" aria-busy={pending}>
          <OtpInput
            id="reset-code"
            value={code}
            onChange={(value) => {
              setCode(value);
              setFieldError(undefined);
            }}
            onFilled={(entered) => verify(entered)}
            length={OTP_LENGTH}
            label={labels.codeLabel}
            hint={labels.codeHint}
            error={fieldError}
            disabled={pending}
            autoFocus
          />

          <Notices error={error} notice={notice} />

          <Button
            type="button"
            onClick={() => verify()}
            className="h-12 w-full gap-3 rounded-xl text-sm shadow-lg shadow-brand/10"
            disabled={pending}
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? labels.verifying : labels.verify}
          </Button>

          {/* Le defi n'apparait qu'une fois le compte a rebours ecoule,
              c'est-a-dire au moment precis ou « Renvoyer » devient actionnable :
              il ne concerne que ce geste, et le poser plus tot mettrait un
              widget en travers d'un ecran ou l'on ne fait que taper six
              chiffres. */}
          {cooldown === 0 ? (
            <Captcha key={captcha.nonce} state={captcha} language={language} labels={captchaLabels} />
          ) : null}

          <Button
            type="button"
            variant="ghost"
            onClick={resend}
            disabled={cooldown > 0 || resending}
            className="h-10 w-full rounded-xl text-sm text-white/70 hover:text-brand"
          >
            {resending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {resending
              ? labels.sending
              : cooldown > 0
                ? fill(labels.resendIn, { seconds: cooldown })
                : labels.resend}
          </Button>
        </div>
      ) : null}

      {step === "password" ? (
        <form onSubmit={save} className="space-y-5" aria-busy={pending}>
          <PasswordField
            id="reset-password"
            label={labels.passwordLabel}
            value={password}
            onChange={(value) => {
              setPassword(value);
              setFieldError(undefined);
            }}
            reveal={reveal}
            // Les deux champs se devoilent ensemble : ils doivent etre tapes a
            // l'identique, n'en montrer qu'un serait un demi-etat deroutant.
            onToggleReveal={() => setReveal((shown) => !shown)}
            labels={labels}
          />
          <PasswordField
            id="reset-confirm"
            label={labels.confirmLabel}
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              setFieldError(undefined);
            }}
            reveal={reveal}
            onToggleReveal={() => setReveal((shown) => !shown)}
            labels={labels}
          />

          <p className="text-xs text-white/50">{fill(labels.passwordHint, { min: PASSWORD_MIN_LENGTH })}</p>

          <FieldError message={fieldError} />
          <Notices error={error} notice={notice} />

          <Button type="submit" className="mt-2 h-12 w-full gap-3 rounded-xl text-sm shadow-lg shadow-brand/10" disabled={pending}>
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? labels.saving : labels.save}
          </Button>
        </form>
      ) : null}

      {/* Un lien, pas un bouton : c'est une navigation. Le `Button` de Base UI
          n'a pas d'`asChild`, d'ou les classes empruntees a ses variantes —
          meme facon de faire que partout ailleurs dans le depot. */}
      {step === "done" ? (
        <Link
          href={signInHref}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 w-full gap-3 rounded-xl text-sm shadow-lg shadow-brand/10",
          )}
        >
          {labels.signIn}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p id="reset-field-error" role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function Notices({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-relaxed text-destructive"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/10 p-3 text-sm leading-relaxed text-brand"
        >
          <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      ) : null}
    </>
  );
}

/** Champ de mot de passe avec son propre oeil, comme a la connexion. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  reveal,
  onToggleReveal,
  labels,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
  labels: Pick<PasswordResetLabels, "showPassword" | "hidePassword">;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyholeIcon
          className="pointer-events-none absolute start-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 rounded-xl border-white/10 bg-white/5 ps-11 pe-12 text-base focus-visible:ring-2 focus-visible:ring-brand/15"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute end-1 top-1 size-10 rounded-lg text-muted-foreground hover:text-white"
          onClick={onToggleReveal}
          aria-label={reveal ? labels.hidePassword : labels.showPassword}
          aria-controls={id}
        >
          {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
