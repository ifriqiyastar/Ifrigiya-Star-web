"use server";

import { revalidatePath } from "next/cache";

import { isSuperAdmin, logAdminAction, requireAdmin } from "@/lib/auth";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { requestPasswordReset } from "@/lib/password-reset";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * Cree un compte administrateur restreint au role RBAC `editeur`
 * (`dashboard.read` + `blog.manage` uniquement, voir
 * `202609230004_admin_editor_role.sql`) — l'unique role que ce geste attribue.
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
 * Le mot de passe n'est jamais choisi ici : un mot de passe jetable est
 * genere pour satisfaire GoTrue, puis remplace par un code a six chiffres
 * envoye par e-mail (`requestPasswordReset`, le meme mecanisme que « Envoyer
 * un code de reinitialisation » sur une fiche compte existante) — la
 * personne invitee choisit elle-meme son mot de passe reel.
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

  // Mot de passe jetable : GoTrue en exige un a la creation, mais personne ne
  // doit le connaitre — voir le code a six chiffres envoye plus bas.
  const throwawayPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: throwawayPassword,
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

  const resetFailed = await requestPasswordReset(service, email);
  await logAdminAction("create_editor_account", "profile", userId, { email, full_name: fullName });
  revalidatePath("/[locale]/admin", "layout");

  if (resetFailed) {
    console.error("createEditorAccount:", resetFailed.reason, resetFailed.detail);
    return ok(
      i18n.t("Compte editeur cree pour {0}, mais l'envoi automatique du code de creation de mot de passe a echoue : envoyez-le manuellement depuis sa fiche compte.", { "0": email }),
    );
  }

  return ok(
    i18n.t("Compte editeur cree pour {0}. Un code de creation de mot de passe lui a ete envoye par e-mail.", { "0": email }),
  );
}
