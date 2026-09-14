import { redirect } from "next/navigation";

import type { AdminDictionary } from "@/lib/i18n/admin-shared";
import { createClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string | null;
  fullName: string | null;
};

export type AdminPermission =
  | "dashboard.read"
  | "users.read"
  | "users.write"
  | "verifications.review"
  | "moderation.manage"
  | "moderation.validate"
  | "events.manage"
  | "events.validate"
  | "evaluations.manage"
  | "finance.manage"
  | "notifications.manage"
  | "audit.read";

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  "dashboard.read", "users.read", "users.write", "verifications.review",
  "moderation.manage", "moderation.validate", "events.manage", "events.validate",
  "evaluations.manage", "finance.manage",
  "notifications.manage", "audit.read",
];

/**
 * Permissions **que le referentiel ne connait pas encore**.
 *
 * `requirePermission()` laisse deja passer un code absent d\'`admin_permissions` :
 * il signifie « le code applicatif est en avance sur la migration RBAC qui le
 * seme », pas « droit refuse ». Cette fonction dit la meme chose a l\'interface,
 * sans quoi les deux se contredisent — et c\'est arrive : le bouton « Valider /
 * Publier » d\'un Scout Day disparaissait de l\'ecran (`events.validate` pas
 * encore semee) alors que le Server Action, lui, aurait accepte. Le seul geste
 * encore visible sur un evenement en attente etait « Cloturer », qui l\'a
 * envoye dans un etat invisible des joueurs.
 */
async function unseededPermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AdminPermission[]> {
  const { data, error } = await supabase.from("admin_permissions").select("code");
  // Referentiel illisible ou vide : on est dans le cas « RBAC pas deploye »,
  // ou tout administrateur garde l\'acces complet.
  if (error || !data?.length) return ALL_ADMIN_PERMISSIONS;
  const known = new Set(data.map((row) => row.code as string));
  return ALL_ADMIN_PERMISSIONS.filter((code) => !known.has(code));
}

/**
 * `dict` n'est requis que pour les deux libelles de repli : le nom du role
 * vient sinon de `admin_roles.label`, ecrit en base et donc dans une seule
 * langue. Les appelants qui ne lisent que `permissions` — une page qui verifie
 * un droit avant d'afficher un bouton — s'en passent.
 */
export async function getAdminAccess(adminId: string, dict?: AdminDictionary) {
  const fallbackLabel = dict?.roles.fallback ?? "Administrateur";
  const unassignedLabel = dict?.roles.unassigned ?? "Role non attribue";
  const supabase = await createClient();
  const assignment = await supabase
    .from("admin_user_roles")
    .select("role_id")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (assignment.error) {
    return { roleLabel: fallbackLabel, permissions: ALL_ADMIN_PERMISSIONS };
  }

  const unseeded = await unseededPermissions(supabase);

  if (!assignment.data) {
    return { roleLabel: unassignedLabel, permissions: unseeded };
  }
  const [role, links] = await Promise.all([
    supabase.from("admin_roles").select("code, label").eq("id", assignment.data.role_id).maybeSingle(),
    supabase.from("admin_role_permissions").select("permission_id").eq("role_id", assignment.data.role_id),
  ]);
  const permissionIds = (links.data ?? []).map((row) => row.permission_id);
  const permissions = permissionIds.length
    ? await supabase.from("admin_permissions").select("code").in("id", permissionIds)
    : { data: [] };
  const granted = (permissions.data ?? []).map((row) => row.code as AdminPermission);
  return {
    roleLabel: (dict && role.data?.code
      ? dict.roles.names[role.data.code as keyof typeof dict.roles.names]
      : undefined) ?? role.data?.label ?? fallbackLabel,
    permissions: [...new Set([...granted, ...unseeded])],
  };
}

/**
 * Garde d'acces du back-office. A appeler dans **chaque** page admin et
 * **chaque** Server Action : une Server Action est joignable par un POST
 * direct, sans passer par l'UI (cf. avertissement de la doc Next sur
 * `use server`).
 *
 * La verification porte sur `profiles.role = 'admin'`, la meme colonne que
 * lit `public.is_admin()` cote Postgres : meme si ce controle applicatif etait
 * contourne, le RLS refuserait les ecritures.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirections volontairement **sans prefixe de langue**. `proxy.ts` resout
  // la langue sur ce saut (cookie, puis `Accept-Language`) et renvoie vers
  // `/ar/connexion` ou `/en/connexion` le cas echeant. C'est aussi la seule
  // forme utilisable ici : `requireAdmin()` est appele depuis des Server
  // Actions, ou `next/root-params` est interdit et ne pourrait donc pas
  // fournir la langue courante.
  if (!user) redirect("/connexion");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, email, full_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  // Session orpheline (ligne profiles supprimee a la main) : le JWT reste
  // valide cote appareil, il faut donc traiter ce cas explicitement.
  if (error || !profile) redirect("/connexion?erreur=compte-introuvable");
  if (profile.role !== "admin") redirect("/connexion?erreur=acces-refuse");
  if (!profile.is_active) redirect("/connexion?erreur=compte-desactive");

  return {
    userId: profile.id,
    email: profile.email ?? user.email ?? null,
    fullName: profile.full_name,
  };
}

/** Controle fin des droits. Le RLS/RPC reste la source d'autorite. */
export async function requirePermission(permission: AdminPermission): Promise<AdminSession> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_has_permission", {
    p_permission: permission,
  });

  // Compatibilite avec le schema historique : tant que la migration RBAC
  // n'est pas appliquee, les comptes `profiles.role = admin` gardent l'acces.
  if (error?.code === "PGRST202" || /admin_has_permission/i.test(error?.message ?? "")) {
    return admin;
  }
  if (error || data !== true) {
    // Deuxieme repli, pour la meme raison que le premier : le code applicatif
    // peut connaitre une permission que la base n'a pas encore semee (une
    // migration RBAC posterieure au deploiement). `admin_has_permission`
    // repond alors « faux » pour un code *inconnu*, exactement comme pour un
    // droit refuse — et l'ecran devient inaccessible a tout le monde, super
    // administrateur compris. On distingue les deux cas en regardant si le
    // code existe au referentiel.
    //
    // Ce n'est pas un trou : les gestes que ces permissions gardent
    // (publier un Scout Day, supprimer un contenu signale) sont de toute
    // facon reserves a `is_super_admin()` par Postgres. La permission ne fait
    // que masquer le bouton.
    if (!(await permissionExists(supabase, permission))) return admin;
    // Surtout pas vers `/admin` : cette page exige `dashboard.read`, donc un
    // administrateur sans role RBAC y echouait au meme controle et repartait
    // en boucle. `/admin/acces-refuse` n'exige que `requireAdmin()`.
    redirect(`/admin/acces-refuse?droit=${encodeURIComponent(permission)}`);
  }
  return admin;
}

/** Le code de permission est-il connu du referentiel RBAC ? */
async function permissionExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  permission: AdminPermission,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_permissions")
    .select("code")
    .eq("code", permission)
    .maybeSingle();
  // Table absente ou illisible : on ne bloque pas sur une incertitude.
  if (error) return false;
  return Boolean(data);
}

/** Trace une action admin dans `admin_audit_log` via le helper SQL dedie. */
export async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_metadata: metadata,
  });
  if (!error) return;

  // Journal retire (table et RPC supprimees) : on se tait. Les appels sont
  // conserves dans tout le code plutot que retires un a un — le jour ou le
  // journal revient, il se remplit a nouveau sans rien rebrancher.
  const journalAbsent =
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    /log_admin_action|admin_audit_log/i.test(error.message ?? "");
  if (journalAbsent) return;

  // Le journal ne doit jamais faire echouer l'action metier elle-meme.
  console.error("log_admin_action:", error.message);
}
