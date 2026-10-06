"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MailCheckIcon, MailIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/admin/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminI18n, useAdminTranslations } from "@/lib/i18n/admin-client";
import { createClient } from "@/lib/supabase/client";

/**
 * Changer l'adresse de connexion.
 *
 * C'est Supabase Auth qui detient l'adresse et qui envoie la confirmation :
 * `updateUser({ email })` ne change rien tout de suite. Le changement ne prend
 * effet qu'une fois le lien de l'e-mail suivi — et, si « Secure email change »
 * est active sur le projet (reglage par defaut), il faut confirmer depuis
 * l'ancienne ET la nouvelle adresse. Tant que ce n'est pas fait, l'ancienne
 * reste celle qui permet de se connecter ; l'ecran l'affiche en attente
 * (`pendingEmail`, lu cote serveur dans `auth.users.new_email`).
 *
 * `profiles.email` suit la nouvelle adresse par le trigger de la migration
 * `202610060001_sync_profile_email.sql` : sans lui, le rail et l'en-tete
 * continueraient d'afficher l'ancienne.
 */
export function EmailChangeForm({
  currentEmail,
  pendingEmail,
  redirectPath,
}: {
  currentEmail: string;
  /** Adresse demandee et pas encore confirmee, s'il y en a une. */
  pendingEmail: string | null;
  /** Ou revenir apres le clic dans l'e-mail — deja prefixe de la langue. */
  redirectPath: string;
}) {
  const i18n = useAdminTranslations();
  const { dict } = useAdminI18n();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (target === currentEmail.trim().toLowerCase()) {
      setError(i18n.t("C'est deja votre adresse actuelle."));
      return;
    }

    setPending(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser(
        { email: target },
        // Ignore par Supabase si l'adresse n'est pas dans la liste des
        // redirections autorisees : il retombe alors sur l'URL du site.
        { emailRedirectTo: `${window.location.origin}${redirectPath}` },
      );
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setEmail("");
      toast.success(i18n.t("Lien de confirmation envoye. Le changement prendra effet apres confirmation."));
      router.refresh();
    } catch {
      setError(dict.common.actionFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3.5 py-3">
        <MailIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="micro-label text-muted-foreground">{i18n.t("Adresse actuelle")}</p>
          <p className="truncate text-sm font-semibold">{currentEmail}</p>
        </div>
      </div>

      {pendingEmail ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-foreground/85">
            {i18n.t("Changement vers {0} en attente : suivez le lien recu par e-mail pour le confirmer. D'ici la, l'adresse actuelle reste celle de connexion.", { "0": pendingEmail })}
          </p>
        </div>
      ) : null}

      <Field
        label={i18n.t("Nouvelle adresse")}
        htmlFor="new_email"
        hint={i18n.t("Un lien de confirmation est envoye ; selon la configuration du projet, l'ancienne adresse doit aussi confirmer.")}
      >
        <Input
          id="new_email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !email.trim()}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          {i18n.t("Envoyer le lien de confirmation")}
        </Button>
      </div>
    </form>
  );
}
