"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import type { ModerationAction, ReportStatus } from "@/lib/labels";

/**
 * Actions §12.2 — moderation des contenus et traitement des signalements.
 *
 * Le schema ne prevoit **pas** de policy DELETE pour l'admin sur `posts` /
 * `post_comments` : la suppression est modelisee par les drapeaux
 * `is_hidden` (masquage par la moderation) et `is_deleted`. C'est voulu — un
 * contenu retire reste consultable par l'administration, ce qui est
 * necessaire pour instruire un signalement.
 */

const REFRESH = () => revalidatePath("/admin", "layout");

export async function setPostHidden(postId: string, hidden: boolean): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { error } = await supabase.from("posts").update({ is_hidden: hidden }).eq("id", postId);
  if (error) return fail(describeError(error));

  await logAdminAction(hidden ? "hide_post" : "unhide_post", "post", postId);
  REFRESH();
  return ok(hidden ? "Publication masquee." : "Publication remise en ligne.");
}

export async function setPostDeleted(postId: string, deleted: boolean): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { error } = await supabase.from("posts").update({ is_deleted: deleted }).eq("id", postId);
  if (error) return fail(describeError(error));

  await logAdminAction(deleted ? "delete_post" : "restore_post", "post", postId);
  REFRESH();
  return ok(deleted ? "Publication supprimee." : "Publication restauree.");
}

export async function setCommentHidden(
  commentId: string,
  hidden: boolean,
): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("post_comments")
    .update({ is_hidden: hidden })
    .eq("id", commentId);
  if (error) return fail(describeError(error));

  await logAdminAction(hidden ? "hide_comment" : "unhide_comment", "post_comment", commentId);
  REFRESH();
  return ok(hidden ? "Commentaire masque." : "Commentaire remis en ligne.");
}

export async function setCommentDeleted(
  commentId: string,
  deleted: boolean,
): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("post_comments")
    .update({ is_deleted: deleted })
    .eq("id", commentId);
  if (error) return fail(describeError(error));

  await logAdminAction(deleted ? "delete_comment" : "restore_comment", "post_comment", commentId);
  REFRESH();
  return ok(deleted ? "Commentaire supprime." : "Commentaire restaure.");
}

/**
 * Videos et photos joueur : ici la policy admin est bien `for all`, donc la
 * suppression est reelle et irreversible. Le fichier de stockage est retire
 * en meme temps que la ligne, sinon l'objet resterait orphelin dans le bucket.
 */
export async function deletePlayerVideo(videoId: string): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("player_videos")
    .select("id, storage_path")
    .eq("id", videoId)
    .maybeSingle();

  const { error } = await supabase.from("player_videos").delete().eq("id", videoId);
  if (error) return fail(describeError(error));

  if (video?.storage_path) {
    await supabase.storage.from("player-videos").remove([video.storage_path]);
  }

  await logAdminAction("delete_player_video", "player_video", videoId);
  REFRESH();
  return ok("Video supprimee.");
}

export async function deletePlayerPhoto(photoId: string): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("player_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .maybeSingle();

  const { error } = await supabase.from("player_photos").delete().eq("id", photoId);
  if (error) return fail(describeError(error));

  if (photo?.storage_path) {
    await supabase.storage.from("player-photos").remove([photo.storage_path]);
  }

  await logAdminAction("delete_player_photo", "player_photo", photoId);
  REFRESH();
  return ok("Photo supprimee.");
}

/**
 * §12.2 — traitement d'un signalement. Une seule ecriture porte a la fois le
 * statut (traite / rejete) et l'action de moderation retenue, pour que
 * `reports` reste le journal de ce qui a ete decide.
 */
export async function resolveReport(
  reportId: string,
  status: ReportStatus,
  moderationAction: ModerationAction,
): Promise<ActionResult> {
  const admin = await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("reports")
    .update({
      status,
      moderation_action: moderationAction,
      handled_by: admin.userId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) return fail(describeError(error));

  await logAdminAction(`report_${status}`, "report", reportId, {
    moderation_action: moderationAction,
  });
  REFRESH();
  return ok(status === "traite" ? "Signalement traite." : "Signalement rejete.");
}

/**
 * §12.2 — suspension d'un utilisateur en cas d'abus. Un compte suspendu doit
 * l'etre a deux endroits : `profiles.is_active` (qui coupe l'acces) et le
 * statut du profil metier, seul lu par le resolveur d'onboarding mobile —
 * sinon un joueur suspendu continuerait a passer la porte d'entree de l'app.
 */
export async function suspendUser(
  profileId: string,
  reason: string,
): Promise<ActionResult> {
  const admin = await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (readError || !profile) return fail("Compte introuvable.");

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) return fail(describeError(error));

  const statusPatch = {
    status: "suspendu",
    status_reason: reason.trim() || null,
    status_updated_by: admin.userId,
    status_updated_at: new Date().toISOString(),
  };

  if (profile.role === "player") {
    await supabase.from("player_profiles").update(statusPatch).eq("id", profileId);
  } else if (profile.role === "professional") {
    await supabase.from("professional_profiles").update(statusPatch).eq("id", profileId);
  }

  await logAdminAction("suspend_user", "profile", profileId, { reason });
  REFRESH();
  return ok("Utilisateur suspendu.");
}
