"use server";

import { EVALUATION_AXES } from "@/lib/evaluation-axes";
import { getRequestAdminI18n } from "@/lib/i18n/admin";


import { revalidatePath } from "next/cache";

import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
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
 *
 * ⚠️ **SIX AXES DEPUIS LA MIGRATION MOBILE 0091** (decision client du
 * 2026-09-24) : vitesse, finition, precision, passe, defense, cognitif. Les
 * quatre de 0030 — technique / physique / tactique / mental — sont devenus
 * facultatifs et ne servent plus qu'a **lire** les evaluations anterieures.
 * `chk_evaluation_axis_set` exige un jeu **complet** ou l'autre : envoyer les
 * six partiellement, ou melanger les deux, est refuse par Postgres.
 *
 * ⚠️⚠️ **Aucune conversion entre les deux jeux, et c'est le point.** Personne
 * ne peut deduire une note de « Precision » d'une note de « technique ».
 * C'est pourquoi la correction d'une evaluation anterieure est **refusee**
 * plutot que re-notee sur six axes : la re-noter reviendrait a inventer six
 * chiffres a partir de quatre, et a changer le sens de ce qui avait ete
 * observe.
 */
export async function saveEvaluation(formData: FormData): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  const admin = await requirePermission("evaluations.manage");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  // Le formulaire nomme ses champs d'apres les colonnes (`speed_score`...) :
  // la liste des axes est celle du module, jamais reecrite ici.
  const scores = Object.fromEntries(
    EVALUATION_AXES.map((axis) => [`${axis.key}_score`, Number(formData.get(`${axis.key}_score`))]),
  );
  const values = Object.values(scores);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return fail(i18n.t("Les six notes sont attendues entre 0 et 100."));
  }
  const comment = String(formData.get("report") ?? "").trim() || null;

  // Correction : on ne touche ni a l'inscription ni a l'evaluateur, qui
  // identifient l'evaluation.
  if (id) {
    // Une evaluation anterieure a 0091 porte quatre axes ; la re-noter sur six
    // inventerait des chiffres, et laisser les deux jeux renseignes ferait
    // basculer `overall_score` sur les six sans que personne l'ait decide.
    const { data: existing } = await supabase
      .from("scout_evaluations")
      .select("speed_score")
      .eq("id", id)
      .maybeSingle();
    if (existing && existing.speed_score === null) {
      return fail(
        i18n.t("Cette evaluation a ete saisie sur l'ancienne grille en quatre domaines. Elle ne peut pas etre renotee sur les six actuels : les deux grilles ne mesurent pas la meme chose."),
      );
    }

    const { error } = await supabase
      .from("scout_evaluations")
      .update({
        ...scores,
        comment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return fail(makeErrors(i18n.locale).describeError(error));

    await logAdminAction("update_evaluation", "scout_evaluation", id, { scores, comment });
    revalidatePath("/[locale]/admin", "layout");
    return ok(i18n.t("Evaluation mise a jour."));
  }

  const registrationId = String(formData.get("registration_id") ?? "").trim();
  const evaluatorId = String(formData.get("evaluator_id") ?? "").trim();
  if (!registrationId) return fail(i18n.t("Selectionnez l'inscription evaluee."));
  if (!evaluatorId) return fail(i18n.t("Selectionnez le professionnel qui signe l'evaluation."));

  const { data: evaluator } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("id", evaluatorId)
    .maybeSingle();
  if (!evaluator) {
    return fail(
      i18n.t("Ce professionnel n'a pas de fiche professionnelle valide : il ne peut pas signer une evaluation."),
    );
  }

  const { data, error } = await supabase
    .from("scout_evaluations")
    .insert({
      registration_id: registrationId,
      evaluator_id: evaluatorId,
      ...scores,
      comment,
    })
    .select("id")
    .single();
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  await logAdminAction("create_evaluation", "scout_evaluation", data.id, {
    registrationId,
    // L'evaluation porte le nom de ce professionnel, mais c'est bien
    // l'administrateur ci-dessus qui l'a saisie.
    signedBy: evaluatorId,
    createdByAdmin: admin.userId,
    scores,
  });
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Evaluation creee. Elle reste privee jusqu'a publication au joueur."));
}

export async function setEvaluationVisibility(id: string, visible: boolean): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  await requirePermission("evaluations.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("scout_evaluations")
    .update({ visible_to_player: visible, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  await logAdminAction(visible ? "publish_evaluation" : "hide_evaluation", "scout_evaluation", id);
  revalidatePath("/[locale]/admin", "layout");
  return ok(visible ? i18n.t("Evaluation publiee au joueur.") : i18n.t("Evaluation masquee au joueur."));
}

/**
 * `scout_evaluations` n'a **aucune** policy DELETE, pour personne — les
 * evaluations sont historisees (§8.4) et le trigger
 * `trg_scout_evaluation_history` capture meme les suppressions. Plutot que de
 * laisser l'utilisateur buter sur un refus RLS opaque, on l'explique.
 */
export async function deleteEvaluation(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  await requirePermission("evaluations.manage");
  await logAdminAction("delete_evaluation_refused", "scout_evaluation", id);
  return fail(
    i18n.t("Les evaluations ne sont pas supprimables : elles sont historisees. Masquez-la au joueur si elle ne doit plus etre visible."),
  );
}
