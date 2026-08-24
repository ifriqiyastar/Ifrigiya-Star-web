"use server";

import { revalidatePath } from "next/cache";

import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function sendNotification(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const targetType = String(formData.get("target_type") ?? "all");
  const targetValue = String(formData.get("target_value") ?? "").trim() || null;
  const channels = formData.getAll("channels").map(String);
  if (!title || !body || channels.length === 0) return fail("Titre, message et canal requis.");

  const { data, error } = await supabase
    .from("admin_notification_campaigns")
    .insert({
      title,
      body,
      target_type: targetType,
      target_value: targetValue,
      channels,
      status: "queued",
      created_by: admin.userId,
    })
    .select("id")
    .single();
  if (error) return fail(describeError(error));
  await logAdminAction("queue_notification", "notification_campaign", data.id, {
    targetType,
    targetValue,
    channels,
  });
  revalidatePath("/admin/notifications");
  return ok("Notification placee dans la file d'envoi.");
}

export async function retryNotification(campaignId: string): Promise<ActionResult> {
  await requirePermission("notifications.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_notification_campaigns")
    .update({ status: "queued", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "failed");
  if (error) return fail(describeError(error));
  await logAdminAction("retry_notification", "notification_campaign", campaignId);
  revalidatePath("/admin/notifications");
  return ok("Nouvelle tentative programmee.");
}
