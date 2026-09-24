"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";

import { isSuperAdmin, logAdminAction, requireAdmin } from "@/lib/auth";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * Meme domaine d'envoi verifie (SPF/DKIM) que `lib/actions/contact.ts` — voir
 * son commentaire. Contrairement au formulaire de contact, l'e-mail part ici
 * vers l'adresse **du compte cree**, pas vers une boite fixe.
 */
const FROM_ADDRESS = "contact@ifriqiya-soccer.com";

/**
 * Mot de passe genere pour le nouvel administrateur : lisible et tapable (12
 * caracteres, alphabet sans caracteres ambigus 0/O/1/l/I), pas un UUID —
 * c'est cette valeur-la qui part dans l'e-mail, l'utilisateur la saisit telle
 * quelle sur `/connexion`.
 */
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

/**
 * Cree un compte administrateur restreint au role RBAC `editeur`
 * (`blog.manage` uniquement depuis `202609230006_editeur_blog_only.sql` — le
 * role portait aussi `dashboard.read` a sa creation, retire ensuite a la
 * demande du client) — l'unique role que ce geste attribue.
 * Reserve au super administrateur : creer un compte revient a donner acces au
 * back-office, un cran au-dessus de `users.write`.
 *
 * Quatre ecritures, dans cet ordre, et trois clients differents :
 *
 * 1. `service_role` cree la ligne `auth.users` — seule l'API Auth Admin le
 *    peut, la cle publishable ne l'a jamais pu.
 * 2. `service_role` ecrit `public.profiles` avec `role = 'player'`, jamais
 *    directement `'admin'` : `trg_prevent_self_role_escalation` s'applique a
 *    ce role-la aussi, et `service_role` n'a pas de `auth.uid()` pour le
 *    satisfaire (voir `lib/supabase/service.ts`).
 * 3. La session de l'administrateur **courant** (client normal, pas
 *    `service_role`) appelle `admin_set_account_role` pour passer ce nouveau
 *    profil en `'admin'` — la meme RPC que la fiche compte utilise déjà
 *    (`updateProfileCore`), qui verifie `is_admin()` sur l'appelant : c'est
 *    justement pour ca qu'elle marche ici la ou une ecriture directe en
 *    `service_role` aurait ete bloquee par le trigger.
 * 4. `service_role` insere dans `admin_user_roles` : cette table n'a
 *    **aucune** policy d'ecriture, meme pour un administrateur authentifie —
 *    voir le commentaire de `202608240001_admin_platform.sql`. C'est le seul
 *    moyen applicatif de faire ce que l'editeur SQL de Supabase fait pour les
 *    autres roles.
 *
 * Le mot de passe est genere ici (`generatePassword()`) et envoye **en clair**
 * par e-mail via Resend, pas via le code a six chiffres de GoTrue
 * (`lib/password-reset.ts`) : demande explicite du client, pour que la
 * personne invitee puisse se connecter directement avec adresse + mot de
 * passe sur `/connexion`, sans etape intermediaire. Deux consequences a
 * connaitre :
 * - l'e-mail transite en clair — c'est strictement moins sur que le code a
 *   six chiffres a usage unique utilise partout ailleurs dans ce depot
 *   (`sendPasswordReset`, mot de passe oublie), d'ou la recommandation de
 *   changer le mot de passe explicite dans le corps du message ;
 * - l'envoi passe par Resend, pas par le SMTP de Supabase Auth (`recover`) :
 *   ce geste ne depend donc pas de la configuration SMTP du projet, separee
 *   et actuellement en panne (voir README, section SMTP).
 */
export async function createEditorAccount(formData: FormData): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  const admin = await requireAdmin();

  if (!(await isSuperAdmin())) {
    return fail(
      i18n.t("Reserve au super administrateur : creer un compte donne acces au back-office."),
    );
  }

  const email = text(formData, "email")?.toLowerCase() ?? null;
  const fullName = text(formData, "full_name");
  if (!email) return fail(i18n.t("L'adresse e-mail est obligatoire."));

  const service = createServiceClient();
  if (!service) {
    return fail(
      i18n.t("Creation impossible : SUPABASE_SERVICE_ROLE_KEY n'est pas configuree dans .env."),
    );
  }

  const password = generatePassword();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (createError) {
    if (createError.code === "email_exists") {
      return fail(
        i18n.t("Un compte existe deja a cette adresse : ouvrez sa fiche pour le passer en administrateur, puis attribuez-lui le role editeur depuis l'editeur SQL de Supabase."),
      );
    }
    return fail(i18n.t("Creation du compte refusee : {0}", { "0": createError.message }));
  }
  const userId = created.user.id;

  const { error: profileError } = await service
    .from("profiles")
    .upsert(
      { id: userId, email, full_name: fullName, role: "player", is_active: true },
      { onConflict: "id" },
    );
  if (profileError) {
    return fail(
      i18n.t("Compte cree mais fiche profil non initialisee ({0}) : contactez le support technique.", { "0": profileError.message }),
    );
  }

  const supabase = await createClient();
  const { error: roleError } = await supabase.rpc("admin_set_account_role", {
    p_profile_id: userId,
    p_role: "admin",
  });
  if (roleError) {
    return fail(
      i18n.t("Compte cree mais passage en administrateur refuse ({0}).", { "0": roleError.message }),
    );
  }

  const { data: role, error: roleLookupError } = await service
    .from("admin_roles")
    .select("id")
    .eq("code", "editeur")
    .maybeSingle();
  if (roleLookupError || !role) {
    return fail(
      i18n.t("Compte cree et promu administrateur, mais le role \"editeur\" n'existe pas encore : appliquez la migration 202609230004_admin_editor_role.sql."),
    );
  }

  const { error: assignError } = await service
    .from("admin_user_roles")
    .upsert(
      { admin_id: userId, role_id: role.id, assigned_by: admin.userId },
      { onConflict: "admin_id" },
    );
  if (assignError) {
    return fail(
      i18n.t("Compte cree et promu administrateur, mais l'attribution du role editeur a echoue ({0}).", { "0": assignError.message }),
    );
  }

  await logAdminAction("create_editor_account", "profile", userId, { email, full_name: fullName });
  revalidatePath("/[locale]/admin", "layout");

  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${i18n.path("/connexion")}`;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return ok(
      i18n.t("Compte editeur cree pour {0}, mais aucun service d'e-mail n'est configure : communiquez ce mot de passe vous-meme : {1}", { "0": email, "1": password }),
    );
  }

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: `Ifriqiya Star <${FROM_ADDRESS}>`,
    to: email,
    subject: i18n.t("Acces a l'espace administrateur Ifriqiya Star"),
    text: i18n.t(
      "Un compte administrateur a ete cree pour vous sur Ifriqiya Star.\n\nAdresse : {0}\nMot de passe : {1}\n\nConnectez-vous ici : {2}\n\nPar securite, changez ce mot de passe des votre premiere connexion.",
      { "0": email, "1": password, "2": loginUrl },
    ),
  });

  if (sendError) {
    console.error("createEditorAccount: resend send failed", sendError);
    return ok(
      i18n.t("Compte editeur cree pour {0}, mais l'envoi de l'e-mail a echoue : communiquez ce mot de passe vous-meme : {1}", { "0": email, "1": password }),
    );
  }

  return ok(
    i18n.t("Compte editeur cree pour {0}. Ses identifiants de connexion lui ont ete envoyes par e-mail.", { "0": email }),
  );
}
