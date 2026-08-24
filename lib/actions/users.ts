"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import type {
  DocumentStatus,
  IdentityVerificationStatus,
  PlayerProfileStatus,
} from "@/lib/labels";

/**
 * Actions §12.1 — validations de comptes et cycle de vie.
 *
 * Chaque action refait un controle de permission : une Server Action est joignable par
 * un POST direct sans passer par l'interface. Le RLS Postgres reste la
 * derniere barriere (`public.is_admin()`), mais on ne s'y repose pas seul.
 * Toute action est ensuite tracee dans `admin_audit_log`.
 */

const REFRESH = () => revalidatePath("/admin", "layout");

/** §12.1 — validation / refus / suspension d'un profil joueur. */
export async function setPlayerStatus(
  playerId: string,
  status: PlayerProfileStatus,
  reason?: string,
): Promise<ActionResult> {
  const admin = await requirePermission("verifications.review");
  const supabase = await createClient();

  const { error } = await supabase
    .from("player_profiles")
    .update({
      status,
      // `status_reason` porte le motif affiche au joueur ; on le vide quand on
      // valide, sinon un ancien motif de refus resterait colle au profil.
      status_reason: status === "valide" ? null : (reason?.trim() || null),
      status_updated_by: admin.userId,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", playerId);

  if (error) return fail(describeError(error));

  await logAdminAction(`player_status_${status}`, "player_profile", playerId, {
    status,
    reason: reason ?? null,
  });
  REFRESH();
  return ok(
    status === "valide"
      ? "Profil joueur valide."
      : `Statut du profil joueur mis a jour : ${status.replace(/_/g, " ")}.`,
  );
}

/** §12.1 — validation / refus / suspension d'un compte professionnel. */
export async function setProfessionalStatus(
  professionalId: string,
  status: PlayerProfileStatus,
  reason?: string,
): Promise<ActionResult> {
  const admin = await requirePermission("verifications.review");
  const supabase = await createClient();

  const { error } = await supabase
    .from("professional_profiles")
    .update({
      status,
      status_reason: status === "valide" ? null : (reason?.trim() || null),
      status_updated_by: admin.userId,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", professionalId);

  if (error) return fail(describeError(error));

  await logAdminAction(`professional_status_${status}`, "professional_profile", professionalId, {
    status,
    reason: reason ?? null,
  });
  REFRESH();
  return ok(
    status === "valide"
      ? "Compte professionnel valide."
      : `Statut du compte professionnel mis a jour : ${status.replace(/_/g, " ")}.`,
  );
}

/** §12.1 — suivi du statut de verification des justificatifs professionnels. */
export async function setDocumentStatus(
  documentId: string,
  status: DocumentStatus,
): Promise<ActionResult> {
  const admin = await requirePermission("verifications.review");
  const supabase = await createClient();

  const { error } = await supabase
    .from("professional_documents")
    .update({ status, reviewed_by: admin.userId, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);

  if (error) return fail(describeError(error));

  await logAdminAction(`document_${status}`, "professional_document", documentId, { status });
  REFRESH();
  return ok(status === "valide" ? "Justificatif valide." : "Justificatif refuse.");
}

/**
 * §12.1 — revue du document d'identite (KYC).
 *
 * Attention : `identity_verifications.status` utilise l'enum
 * `identity_verification_status`, **distinct** de `player_profile_status`.
 * Valider le KYC ne valide pas le compte : c'est `player_profiles.status` que
 * lit le resolveur d'onboarding de l'app mobile. Les deux gestes sont donc
 * proposes separement dans l'interface.
 */
export async function setIdentityStatus(
  verificationId: string,
  status: IdentityVerificationStatus,
  rejectionReason?: string,
): Promise<ActionResult> {
  const admin = await requirePermission("verifications.review");
  const supabase = await createClient();

  const { error } = await supabase
    .from("identity_verifications")
    .update({
      status,
      rejection_reason: status === "refuse" ? (rejectionReason?.trim() || null) : null,
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", verificationId);

  if (error) return fail(describeError(error));

  await logAdminAction(`identity_${status}`, "identity_verification", verificationId, { status });
  REFRESH();
  return ok(`Verification d'identite : ${status.replace(/_/g, " ")}.`);
}

/** §12.1 — desactivation / reactivation d'un compte (reversible). */
export async function setAccountActive(
  profileId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requirePermission("users.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_active: isActive,
      deactivated_at: isActive ? null : new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) return fail(describeError(error));

  await logAdminAction(isActive ? "reactivate_user" : "deactivate_user", "profile", profileId);
  REFRESH();
  return ok(isActive ? "Compte reactive." : "Compte desactive.");
}

/** Visibilite du profil joueur dans la recherche professionnelle (§5.1). */
export async function setPlayerVisibility(
  playerId: string,
  isVisible: boolean,
): Promise<ActionResult> {
  await requirePermission("users.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("player_profiles")
    .update({ is_visible: isVisible })
    .eq("id", playerId);

  if (error) return fail(describeError(error));

  await logAdminAction(
    isVisible ? "show_player_profile" : "hide_player_profile",
    "player_profile",
    playerId,
  );
  REFRESH();
  return ok(isVisible ? "Profil rendu visible." : "Profil retire de la recherche.");
}

/**
 * §12.1 — suppression d'un compte.
 *
 * La suppression definitive passe par l'API Auth Admin, donc par la cle
 * `service_role` : supprimer seulement `public.profiles` laisserait le JWT
 * deja emis valide sur l'appareil (piege documente cote app mobile), et le
 * RLS n'expose de toute facon aucune policy DELETE sur `profiles`.
 *
 * Sans cette cle, on desactive le compte et on horodate
 * `deletion_requested_at` : la demande reste tracee et reversible.
 */
export async function deleteAccount(profileId: string): Promise<ActionResult> {
  await requirePermission("users.write");
  const service = createServiceClient();

  if (!service) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deletion_requested_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) return fail(describeError(error));

    await logAdminAction("request_account_deletion", "profile", profileId, {
      reason: "SUPABASE_SERVICE_ROLE_KEY absente",
    });
    REFRESH();
    return ok(
      "Compte desactive et suppression demandee. La suppression definitive necessite SUPABASE_SERVICE_ROLE_KEY dans .env.",
    );
  }

  // La cascade `on delete cascade` depuis auth.users nettoie profiles et tout
  // ce qui en depend (profil joueur/pro, videos, inscriptions…).
  const { error } = await service.auth.admin.deleteUser(profileId);
  if (error) return fail(error.message);

  await logAdminAction("delete_account", "profile", profileId);
  REFRESH();
  return ok("Compte supprime definitivement.");
}

/** §12.1 — modification de la fiche compte selon les droits administrateur. */
export async function updateProfileCore(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("users.write");
  const supabase = await createClient();

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const role = text("role");
  const payload: Record<string, unknown> = {
    full_name: text("full_name"),
    phone: text("phone"),
    locale: text("locale") ?? "fr",
  };
  // Le trigger `prevent_self_role_escalation` interdit a un utilisateur de
  // changer son propre role ; on ne transmet donc la colonne que si elle
  // change vraiment, pour ne pas declencher le garde-fou inutilement.
  if (role && ["player", "professional", "admin"].includes(role)) payload.role = role;

  const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
  if (error) return fail(describeError(error));

  await logAdminAction("update_profile", "profile", profileId, payload);
  REFRESH();
  return ok("Fiche compte enregistree.");
}

/** §12.1 — modification du profil sportif d'un joueur. */
export async function updatePlayerProfile(
  playerId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("users.write");
  const supabase = await createClient();

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const number = (key: string) => {
    const value = text(key);
    if (!value) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const firstName = text("first_name");
  const lastName = text("last_name");
  const birthDate = text("birth_date");
  if (!firstName || !lastName || !birthDate) {
    return fail("Prenom, nom et date de naissance sont obligatoires.");
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    birth_date: birthDate,
    nationality: text("nationality"),
    country: text("country"),
    city: text("city"),
    main_position: text("main_position"),
    secondary_position: text("secondary_position"),
    foot_preference: text("foot_preference"),
    current_club: text("current_club"),
    is_free_agent: formData.get("is_free_agent") === "on",
    height_cm: number("height_cm"),
    weight_kg: number("weight_kg"),
    level: text("level") ?? "amateur",
    about: text("about"),
  };

  const { error } = await supabase.from("player_profiles").update(payload).eq("id", playerId);
  if (error) return fail(describeError(error));

  await logAdminAction("update_player_profile", "player_profile", playerId);
  REFRESH();
  return ok("Profil sportif enregistre.");
}

/** §12.1 — modification de la fiche d'un compte professionnel. */
export async function updateProfessionalProfile(
  professionalId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("users.write");
  const supabase = await createClient();

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const contactFullName = text("contact_full_name");
  const professionalType = text("professional_type");
  if (!contactFullName || !professionalType) {
    return fail("Le type de compte et le nom du contact sont obligatoires.");
  }

  const payload = {
    professional_type: professionalType,
    organization_name: text("organization_name"),
    contact_full_name: contactFullName,
    position_title: text("position_title"),
    country: text("country"),
    city: text("city"),
  };

  const { error } = await supabase
    .from("professional_profiles")
    .update(payload)
    .eq("id", professionalId);
  if (error) return fail(describeError(error));

  await logAdminAction("update_professional_profile", "professional_profile", professionalId);
  REFRESH();
  return ok("Fiche professionnelle enregistree.");
}
