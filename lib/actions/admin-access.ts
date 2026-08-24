"use server";

import { revalidatePath } from "next/cache";

import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function assignAdminRole(formData: FormData): Promise<ActionResult> {
  const actor = await requirePermission("admins.manage");
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "").trim();
  if (!profileId || !roleId) return fail("Administrateur et role requis.");
  if (profileId === actor.userId) return fail("Vous ne pouvez pas modifier votre propre role.");
  const supabase = await createClient();
  const { error } = await supabase.from("admin_user_roles").upsert(
    { admin_id: profileId, role_id: roleId, assigned_by: actor.userId },
    { onConflict: "admin_id" },
  );
  if (error) return fail(describeError(error));
  await logAdminAction("assign_admin_role", "profile", profileId, { roleId });
  revalidatePath("/admin/acces");
  return ok("Role administrateur attribue.");
}
