"use server";

import { revalidatePath } from "next/cache";

import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Creation ou correction d'une evaluation de scouting (§8.4).
 *
 * La creation par l'administration est possible depuis l'ajout de la policy
 * `evaluations_insert_admin`. Deux consequences a garder en tete :
 *
 * - `evaluator_id` reference `professional_profiles(id)`, pas `profiles(id)` :
 *   l'evaluation est donc **signee par un professionnel**, que l'administrateur
 *   doit designer. On verifie que la fiche existe avant l'insert, pour renvoyer
 *   un message clair plutot qu'une violation de cle etrangere.
 * - Qui a reellement saisi le rapport reste tracable : `admin_audit_log`
 *   enregistre l'administrateur, et la metadonnee retient le professionnel au
 *   nom duquel il a agi.
 *
 * `overall_score` n'est jamais transmis : c'est une colonne
 * GENERATED ALWAYS STORED, Postgres la recalcule. Et le rapport tient dans
 * `comment`, seule colonne de texte de la table.
 */
export async function saveEvaluation(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("evaluations.manage");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  const scores = ["technical_score", "physical_score", "tactical_score", "mental_score"].map(
    (key) => Number(formData.get(key)),
  );
  if (scores.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return fail("Les quatre notes sont attendues entre 0 et 100.");
  }
  const comment = String(formData.get("report") ?? "").trim() || null;

  // Correction : on ne touche ni a l'inscription ni a l'evaluateur, qui
  // identifient l'evaluation.
  if (id) {
    const { error } = await supabase
      .from("scout_evaluations")
      .update({
        technical_score: scores[0],
        physical_score: scores[1],
        tactical_score: scores[2],
        mental_score: scores[3],
        comment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return fail(describeError(error));

    await logAdminAction("update_evaluation", "scout_evaluation", id, { scores, comment });
    revalidatePath("/admin", "layout");
    return ok("Evaluation mise a jour.");
  }

  const registrationId = String(formData.get("registration_id") ?? "").trim();
  const evaluatorId = String(formData.get("evaluator_id") ?? "").trim();
  if (!registrationId) return fail("Selectionnez l'inscription evaluee.");
  if (!evaluatorId) return fail("Selectionnez le professionnel qui signe l'evaluation.");

  const { data: evaluator } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("id", evaluatorId)
    .maybeSingle();
  if (!evaluator) {
    return fail(
      "Ce professionnel n'a pas de fiche professionnelle valide : il ne peut pas signer une evaluation.",
    );
  }

  const { data, error } = await supabase
    .from("scout_evaluations")
    .insert({
      registration_id: registrationId,
      evaluator_id: evaluatorId,
      technical_score: scores[0],
      physical_score: scores[1],
      tactical_score: scores[2],
      mental_score: scores[3],
      comment,
    })
    .select("id")
    .single();
  if (error) return fail(describeError(error));

  await logAdminAction("create_evaluation", "scout_evaluation", data.id, {
    registrationId,
    // L'evaluation porte le nom de ce professionnel, mais c'est bien
    // l'administrateur ci-dessus qui l'a saisie.
    signedBy: evaluatorId,
    createdByAdmin: admin.userId,
    scores,
  });
  revalidatePath("/admin", "layout");
  return ok("Evaluation creee. Elle reste privee jusqu'a publication au joueur.");
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

/**
 * `scout_evaluations` n'a **aucune** policy DELETE, pour personne — les
 * evaluations sont historisees (§8.4) et le trigger
 * `trg_scout_evaluation_history` capture meme les suppressions. Plutot que de
 * laisser l'utilisateur buter sur un refus RLS opaque, on l'explique.
 */
export async function deleteEvaluation(id: string): Promise<ActionResult> {
  await requirePermission("evaluations.manage");
  await logAdminAction("delete_evaluation_refused", "scout_evaluation", id);
  return fail(
    "Les evaluations ne sont pas supprimables : elles sont historisees. Masquez-la au joueur si elle ne doit plus etre visible.",
  );
}
