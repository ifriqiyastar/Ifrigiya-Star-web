"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Captcha, useCaptcha } from "@/components/captcha";
import { Field } from "@/components/admin/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminI18n, useAdminTranslations } from "@/lib/i18n/admin-client";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

/**
 * Changer son mot de passe depuis la session ouverte.
 *
 * L'ancien mot de passe est verifie en se reconnectant avec lui, exactement
 * comme l'ecran de suppression de compte de l'application mobile
 * (`src/app/delete-account.tsx`) — et pour la meme raison : le projet a la
 * protection captcha activee, et c'est le seul controle qui marche avec elle.
 * D'ou le widget anti-robot sur ce formulaire.
 *
 * ⚠️ `signInWithPassword()` REMPLACE la session. L'adresse est donc celle du
 * compte deja ouvert (lue a la source, jamais saisie), et l'identifiant rendu
 * par GoTrue est compare a celui d'avant : on ne doit jamais se retrouver
 * connecte sous un autre compte au moment d'en changer le mot de passe.
 *
 * ⚠️ Un jeton captcha ne sert qu'une fois : `captcha.reset()` sur tous les
 * chemins de sortie, refus compris.
 *
 * L'avis « votre mot de passe a ete modifie » part tout seul (migration
 * mobile 0063, trigger sur `auth.users`) : rien a envoyer d'ici.
 */
export function PasswordChangeForm() {
  const i18n = useAdminTranslations();
  const { locale, dict } = useAdminI18n();
  const router = useRouter();
  const captcha = useCaptcha();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (next.length < MIN_LENGTH) {
      setError(i18n.t("Le nouveau mot de passe doit contenir au moins {0} caracteres.", { "0": MIN_LENGTH }));
      return;
    }
    if (next !== confirm) {
      setError(i18n.t("Les deux saisies du nouveau mot de passe ne correspondent pas."));
      return;
    }
    if (next === current) {
      setError(i18n.t("Le nouveau mot de passe doit etre different de l'actuel."));
      return;
    }
    if (captcha.enabled && !captcha.token) {
      setError(dict.signIn.captchaRequired);
      return;
    }

    setPending(true);
    const supabase = createClient();
    try {
      const { data: before } = await supabase.auth.getUser();
      const accountId = before.user?.id;
      const email = before.user?.email;
      if (!accountId || !email) {
        setError(i18n.t("Session expiree : reconnectez-vous puis recommencez."));
        return;
      }

      const { data: check, error: checkError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
        options: { captchaToken: captcha.token ?? undefined },
      });
      if (checkError) {
        setError(/captcha/i.test(checkError.message) ? dict.signIn.captchaRejected : i18n.t("Mot de passe actuel incorrect."));
        return;
      }
      if (check.user?.id !== accountId) {
        // Ne devrait pas arriver — l'adresse est celle du compte ouvert — mais
        // si c'etait le cas on aurait change de compte : on ferme tout.
        await supabase.auth.signOut();
        router.replace("/connexion");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(i18n.t("Mot de passe modifie. Un e-mail de confirmation vous a ete envoye."));
      router.refresh();
    } catch {
      setError(dict.common.actionFailed);
    } finally {
      captcha.reset();
      setPending(false);
    }
  }

  const type = show ? "text" : "password";
  const toggle = (
    <button
      type="button"
      onClick={() => setShow((value) => !value)}
      aria-label={show ? dict.signIn.hidePassword : dict.signIn.showPassword}
      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    >
      {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={i18n.t("Mot de passe actuel")} htmlFor="current_password">
        <div className="relative">
          <Input
            id="current_password"
            type={type}
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className="pr-10"
          />
          {toggle}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={i18n.t("Nouveau mot de passe")}
          htmlFor="new_password"
          hint={i18n.t("{0} caracteres au minimum.", { "0": MIN_LENGTH })}
        >
          <Input
            id="new_password"
            type={type}
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>
        <Field label={i18n.t("Confirmer le nouveau mot de passe")} htmlFor="confirm_password">
          <Input
            id="confirm_password"
            type={type}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
      </div>

      {captcha.enabled ? (
        <Captcha
          key={captcha.nonce}
          state={captcha}
          language={locale}
          labels={{
            label: dict.signIn.captchaLabel,
            loading: dict.signIn.captchaLoading,
            failed: dict.signIn.captchaFailed,
            retry: dict.signIn.captchaRetry,
          }}
        />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
          {i18n.t("Changer le mot de passe")}
        </Button>
      </div>
    </form>
  );
}
