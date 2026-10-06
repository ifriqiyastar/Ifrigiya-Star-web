import type { Metadata } from "next";
import { IdCardIcon, KeyRoundIcon, LanguagesIcon, MailIcon, ShieldCheckIcon, UserIcon } from "lucide-react";

import { BrandMark } from "@/components/admin/brand-mark";
import { Field } from "@/components/admin/forms/field";
import { NoteCards } from "@/components/admin/note-cards";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { EmailChangeForm } from "@/components/admin/profile/email-change-form";
import { PasswordChangeForm } from "@/components/admin/profile/password-change-form";
import { ServerForm } from "@/components/admin/server-form";
import { Input } from "@/components/ui/input";
import { updateOwnProfile } from "@/lib/actions/profile";
import { getAdminAccess, requireAdmin } from "@/lib/auth";
import { getAdminDict, getAdminI18n } from "@/lib/i18n/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Mon profil") };
}

/**
 * Le profil de l'administrateur connecte : identite, adresse de connexion,
 * mot de passe.
 *
 * Accessible a tout administrateur, sans permission particuliere — c'est son
 * propre compte, pas un ecran de gestion. Ce qui n'y figure pas, et pourquoi :
 * la photo (aucune colonne ni stockage pour un administrateur dans le
 * schema), le role (il se change en SQL, migration 202608240006) et la langue
 * (elle a deja son ecran, Parametres).
 */
export default async function ProfilPage() {
  const admin = await requireAdmin();
  const i18n = await getAdminI18n();
  const supabase = await createClient();

  // `dict` d'abord : `getAdminAccess` est memoise par requete sur ses
  // arguments, et le layout l'appelle deja avec ce meme dictionnaire — passer
  // les memes arguments reutilise sa lecture au lieu d'en refaire une.
  const dict = await getAdminDict();
  const [access, { data: profile }, { data: auth }] = await Promise.all([
    getAdminAccess(admin.userId, dict),
    supabase.from("profiles").select("full_name, phone, email").eq("id", admin.userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  // L'adresse de connexion fait foi : c'est celle d'Auth, pas la copie de
  // `profiles`, qui peut avoir un temps de retard.
  const loginEmail = auth.user?.email ?? profile?.email ?? admin.email ?? "";
  const pendingEmail = auth.user?.new_email ?? null;
  const name = profile?.full_name?.trim() || loginEmail;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: i18n.t("Compte") }, { label: i18n.t("Mon profil") }]}
        title={i18n.t("Mon profil")}
        description={i18n.t("Vos informations d'administrateur : identite, adresse de connexion et mot de passe.")}
      />

      {/* Carte d'identite : ce que les autres administrateurs voient de vous. */}
      <Panel className="flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-border">
          <BrandMark size={56} className="size-full" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg font-bold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{loginEmail}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/25">
          <ShieldCheckIcon className="size-3.5" />
          {access.roleLabel}
        </span>
      </Panel>

      {/* Bordure visible sur les six champs. Dans `.admin-dashboard-shell`,
          `--input` vaut `#000000` et le fond d'un champ est presque noir : un
          champ vide — mot de passe, nouvelle adresse, telephone — n'avait
          plus de contour et disparaissait dans le panneau. `:not(:focus-visible)`
          laisse la couleur de focus du champ reprendre la main au clic. */}
      <div className="grid gap-6 lg:grid-cols-2 [&_[data-slot=input]:not(:focus-visible)]:border-border">

        <Panel>
          <PanelHeader
            icon={UserIcon}
            title={i18n.t("Identite")}
            description={i18n.t("Le nom affiche dans le back-office et dans les traces de decision.")}
          />
          <ServerForm
            action={updateOwnProfile}
            submitLabel={i18n.t("Enregistrer")}
            className="space-y-4 p-5 [&>button:last-child]:ml-auto [&>button:last-child]:flex [&>button:last-child]:w-fit"
          >
            <Field label={i18n.t("Nom complet")} htmlFor="full_name">
              <Input id="full_name" name="full_name" required maxLength={120} autoComplete="name" defaultValue={profile?.full_name ?? ""} />
            </Field>
            <Field label={i18n.t("Telephone")} htmlFor="phone" hint={i18n.t("Facultatif.")}>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone ?? ""} />
            </Field>
          </ServerForm>
        </Panel>

        <Panel>
          <PanelHeader
            icon={MailIcon}
            title={i18n.t("Adresse e-mail")}
            description={i18n.t("L'adresse avec laquelle vous vous connectez.")}
          />
          <div className="p-5">
            <EmailChangeForm
              currentEmail={loginEmail}
              pendingEmail={pendingEmail}
              redirectPath={i18n.path("/admin/profil")}
            />
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            icon={KeyRoundIcon}
            title={i18n.t("Mot de passe")}
            description={i18n.t("Votre mot de passe actuel est demande pour confirmer qu'il s'agit bien de vous.")}
          />
          <div className="p-5">
            <PasswordChangeForm />
          </div>
        </Panel>
      </div>

      <NoteCards
        notes={[
          {
            icon: IdCardIcon,
            title: i18n.t("Role et droits"),
            body: i18n.t("Votre role ne se modifie pas ici : il est attribue par un super administrateur."),
          },
          {
            icon: LanguagesIcon,
            title: dict.language.label,
            body: i18n.t("La langue du back-office se regle dans Parametres."),
          },
        ]}
      />
    </div>
  );
}
