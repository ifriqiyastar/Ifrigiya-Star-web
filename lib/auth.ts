import { redirect } from "next/navigation";

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
  | "events.manage"
  | "evaluations.manage"
  | "finance.manage"
  | "notifications.manage"
  | "audit.read"
  | "admins.manage";

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  "dashboard.read", "users.read", "users.write", "verifications.review",
  "moderation.manage", "events.manage", "evaluations.manage", "finance.manage",
  "notifications.manage", "audit.read", "admins.manage",
];

export async function getAdminAccess(adminId: string) {
  const supabase = await createClient();
  const assignment = await supabase
    .from("admin_user_roles")
    .select("role_id")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (assignment.error) {
    return { roleLabel: "Administrateur", permissions: ALL_ADMIN_PERMISSIONS };
  }
  if (!assignment.data) return { roleLabel: "Role non attribue", permissions: [] as AdminPermission[] };
  const [role, links] = await Promise.all([
    supabase.from("admin_roles").select("label").eq("id", assignment.data.role_id).maybeSingle(),
    supabase.from("admin_role_permissions").select("permission_id").eq("role_id", assignment.data.role_id),
  ]);
  const permissionIds = (links.data ?? []).map((row) => row.permission_id);
  const permissions = permissionIds.length
    ? await supabase.from("admin_permissions").select("code").in("id", permissionIds)
    : { data: [] };
  return {
    roleLabel: role.data?.label ?? "Administrateur",
    permissions: (permissions.data ?? []).map((row) => row.code as AdminPermission),
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
  if (error || data !== true) redirect("/admin?erreur=permission-refusee");
  return admin;
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
  // Le journal ne doit jamais faire echouer l'action metier elle-meme.
  if (error) console.error("log_admin_action:", error.message);
}
