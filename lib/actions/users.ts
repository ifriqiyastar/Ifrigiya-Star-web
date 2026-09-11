"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { describeError, describeRpcError, fail, ok, type ActionResult } from "@/lib/actions/result";
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

const REFRESH = () => revalidatePath("/[locale]/admin", "layout");

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

  if (error) return fail(describeStatusError(error));

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

/**
 * Validation groupee de plusieurs profils joueurs (« Validation groupee » des
 * maquettes).
 *
 * Elle ne court-circuite rien : chaque ligne passe par la meme mise a jour que
 * le geste unitaire, donc par `verifications.review`, par les policies RLS et
 * par les triggers de `player_profiles`. Le compte rendu distingue les profils
 * reellement valides de ceux que Postgres a refuses — un « 3 valides » global
 * masquerait un echec silencieux.
 */
export async function bulkValidatePlayers(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("verifications.review");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) return fail("Selectionnez au moins un dossier.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_profiles")
    .update({
      status: "valide",
      status_reason: null,
      status_updated_by: admin.userId,
      status_updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("status", "en_attente_validation")
    .select("id");

  if (error) return fail(describeStatusError(error));

  const updated = data?.length ?? 0;
  for (const id of data ?? []) {
    await logAdminAction("player_status_valide", "player_profile", id.id, { bulk: true });
  }
  REFRESH();

  if (!updated) {
    return fail(
      "Aucun profil n'a change d'etat : la selection a peut-etre deja ete traitee ailleurs.",
    );
  }
  return updated === ids.length
    ? ok(`${updated} profil(s) joueur valide(s).`)
    : ok(
        `${updated} profil(s) valide(s) sur ${ids.length} : les autres n'etaient plus en attente.`,
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

  if (error) return fail(describeStatusError(error));

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

/**
 * Le refus le plus deroutant de la validation de compte.
 *
 * `notify_player_status_change()` / `notify_professional_status_change()`
 * choisissent le type de notification par un `case … end`, dont les branches
 * se resolvent **entre elles** avant la colonne cible : le resultat est `text`,
 * et il n'existe aucune conversion implicite vers un enum. Les triggers etant
 * `after update`, l'erreur remonte sur l'UPDATE lui-meme — passer un compte a
 * « valide » devient tout simplement impossible, a la main comme depuis cet
 * ecran. C'est ce que corrige la migration 0017, qui n'est pas dans la plage
 * appliquee (« 0016, 0018-0029 ») du depot mobile.
 */
function describeStatusError(error: { code?: string; message: string; hint?: string | null }) {
  if (error.code === "42804" || /notification_type/i.test(error.message)) {
    return "Validation impossible : appliquez la migration 0017_notification_type_cast.sql (depot mobile). Sans elle, le trigger de notification refuse tout passage a « valide » ou « refuse » (42804).";
  }
  return describeError(error);
}

/** §12.1 — desactivation / reactivation d'un compte (reversible). */
export async function setAccountActive(
  profileId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requirePermission("users.write");
  const supabase = await createClient();

  // `profiles.is_active` n'est pas ecrivable par une session administrateur :
  // la migration 0025 a revoque ce privilege de colonne a `authenticated` pour
  // qu'un utilisateur ne se promeuve pas. La RPC de 0044 le rend a Postgres,
  // avec son propre controle `is_admin()`, et aligne le statut du profil
  // metier — que le resolveur d'onboarding mobile lit, lui, pour laisser
  // entrer ou non.
  const { data, error } = await supabase.rpc("admin_set_account_active", {
    p_profile_id: profileId,
    p_active: isActive,
    p_reason: null,
  });

  if (error) {
    return fail(
      describeRpcError(
        error,
        "admin_set_account_active",
        isActive ? "Reactivation indisponible" : "Desactivation indisponible",
      ),
    );
  }
  if (data === false) return fail("Compte introuvable.");

  await logAdminAction(isActive ? "reactivate_user" : "deactivate_user", "profile", profileId);
  REFRESH();
  // « Compte reactive » etait exact et trompeur : la RPC de 0044 ne remonte
  // pas le profil metier a « valide » mais a « en_attente_validation », et
  // c'est un statut que l'application mobile bloque aussi. Reactiver ne rend
  // donc pas l'acces — il rend le dossier a la file de validation.
  return ok(
    isActive
      ? "Compte reactive. Le profil metier repasse en « en attente de validation » : l'utilisateur reste bloque a la connexion jusqu'a ce que vous validiez son dossier dans Validations."
      : "Compte desactive et profil metier passe en « suspendu » : l'application refuse la connexion et deconnecte le compte au prochain demarrage.",
  );
}

/**
 * §12.1 — **lever une suspension**, en un seul geste.
 *
 * Lever une suspension demandait deux clics dans un ordre precis, et rien ne
 * le disait :
 *
 *   1. « Reactiver » appelle `admin_set_account_active(true)`, qui remet
 *      `is_active` mais renvoie le profil metier a `en_attente_validation` —
 *      un statut que l'application mobile bloque **aussi** ;
 *   2. « Valider le compte » le repasse a `valide`.
 *
 * Un administrateur qui s'arretait apres le premier clic croyait avoir rendu
 * l'acces, alors que l'utilisateur restait dehors. Cette action enchaine les
 * deux, dans l'ordre : sans l'etape 1 le compte reste `is_active = false`, et
 * sans l'etape 2 il reste bloque.
 *
 * Le passage a `valide` declenche `notify_player_status_change` /
 * `notify_professional_status_change` : l'utilisateur est prevenu que son
 * profil est de nouveau valide. C'est voulu — on ne lui rend pas l'acces en
 * silence.
 */
export async function liftSuspension(profileId: string): Promise<ActionResult> {
  const admin = await requirePermission("users.write");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return fail("Compte introuvable.");

  // Etape 1 : `is_active` n'est pas ecrivable par une session administrateur
  // (colonne revoquee par 0025), d'ou la RPC de 0044.
  const { data: reactivated, error: activeError } = await supabase.rpc(
    "admin_set_account_active",
    { p_profile_id: profileId, p_active: true, p_reason: null },
  );
  if (activeError) {
    return fail(
      describeRpcError(activeError, "admin_set_account_active", "Levee de suspension indisponible"),
    );
  }
  if (reactivated === false) return fail("Compte introuvable.");

  // Etape 2 : le statut metier, ecrit directement — `player_profiles` et
  // `professional_profiles` n'ont subi aucun revoke de colonne, et les
  // policies `*_update_admin` autorisent l'ecriture.
  const table = profile.role === "player" ? "player_profiles" : "professional_profiles";
  if (profile.role === "player" || profile.role === "professional") {
    const { error } = await supabase
      .from(table)
      .update({
        status: "valide",
        status_reason: null,
        status_updated_by: admin.userId,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    if (error) {
      return fail(
        `Compte reactive, mais le profil metier est reste en attente de validation : ${describeStatusError(error)}`,
      );
    }
  }

  await logAdminAction("lift_suspension", "profile", profileId, { role: profile.role });
  REFRESH();
  return ok("Suspension levee : le compte est actif et son profil de nouveau valide.");
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
    // Meme raison qu'au-dessus : `is_active` et `deactivated_at` sont revoques
    // a `authenticated` depuis 0025, seul `deletion_requested_at` restait
    // ecrivable — la desactivation echouait donc silencieusement a moitie.
    const { data, error } = await supabase.rpc("admin_request_account_deletion", {
      p_profile_id: profileId,
    });

    if (error) {
      return fail(
        describeRpcError(error, "admin_request_account_deletion", "Suppression indisponible"),
      );
    }
    if (data === false) return fail("Compte introuvable.");

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
  // `full_name`, `phone` et `locale` font partie des colonnes que 0025 a
  // laissees ecrivables ; `role` non — il passe par la RPC de 0044, qui
  // refuse au passage qu'un administrateur change le sien.
  const payload: Record<string, unknown> = {
    full_name: text("full_name"),
    phone: text("phone"),
    locale: text("locale") ?? "fr",
  };

  const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
  if (error) return fail(describeError(error));

  if (role && ["player", "professional", "admin"].includes(role)) {
    const { data: current } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .maybeSingle();
    // On n'appelle la RPC que si le role change vraiment : inutile de
    // declencher le garde-fou anti-escalade pour une valeur identique.
    if (current && current.role !== role) {
      const { error: roleError } = await supabase.rpc("admin_set_account_role", {
        p_profile_id: profileId,
        p_role: role,
      });
      if (roleError) {
        return fail(
          describeRpcError(roleError, "admin_set_account_role", "Changement de role indisponible"),
        );
      }
      payload.role = role;
    }
  }

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
