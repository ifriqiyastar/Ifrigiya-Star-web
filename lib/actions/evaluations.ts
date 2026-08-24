"use server";

import { revalidatePath } from "next/cache";

import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const score = (form: FormData, key: string) => Number(form.get(key));

export async function saveEvaluation(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("evaluations.manage");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const registrationId = String(formData.get("registration_id") ?? "").trim();
  const scores = ["technical_score", "physical_score", "tactical_score", "mental_score"].map(
    (key) => score(formData, key),
  );
  if (!registrationId || scores.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return fail("Inscription requise et notes attendues entre 0 et 100.");
  }

  // La note globale n'est jamais acceptee depuis le navigateur.
  const payload = {
    registration_id: registrationId,
    evaluator_id: admin.userId,
    technical_score: scores[0],
    physical_score: scores[1],
    tactical_score: scores[2],
    mental_score: scores[3],
    overall_score: Math.round((scores.reduce((sum, value) => sum + value, 0) / 4) * 100) / 100,
    report: String(formData.get("report") ?? "").trim() || null,
    comments: String(formData.get("comments") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("scout_evaluations").update(payload).eq("id", id)
    : supabase.from("scout_evaluations").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) return fail(describeError(error));
  const targetId = id || String((data as { id?: string } | null)?.id ?? registrationId);
  await logAdminAction(id ? "update_evaluation" : "create_evaluation", "scout_evaluation", targetId, payload);
  revalidatePath("/admin", "layout");
  return ok(id ? "Evaluation mise a jour." : "Evaluation creee.");
}

export async function setEvaluationVisibility(id: string, visible: boolean): Promise<ActionResult> {
  await requirePermission("evaluations.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_evaluations")
    .update({ visible_to_player: visible, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(describeError(error));
  await logAdminAction(visible ? "publish_evaluation" : "hide_evaluation", "scout_evaluation", id);
  revalidatePath("/admin", "layout");
  return ok(visible ? "Evaluation publiee au joueur." : "Evaluation masquee au joueur.");
}

export async function deleteEvaluation(id: string): Promise<ActionResult> {
  await requirePermission("evaluations.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("scout_evaluations").delete().eq("id", id);
  if (error) return fail(describeError(error));
  await logAdminAction("delete_evaluation", "scout_evaluation", id);
  revalidatePath("/admin", "layout");
  return ok("Evaluation supprimee.");
}
