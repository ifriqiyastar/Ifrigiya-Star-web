"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { describeError, describeRpcError, fail, ok, type ActionResult } from "@/lib/actions/result";
import type { ModerationAction } from "@/lib/labels";
import { QUARANTINABLE, removalOptions } from "@/lib/moderation-targets";

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


/**
 * Masque ou demasque une publication / un commentaire.
 *
 * Trois chemins, dans cet ordre, parce que la colonne `is_hidden` n'est pas
 * ecrivable par une session administrateur : les migrations 0033 et 0035 ont
 * **revoque `update (is_hidden)`** au role `authenticated` pour qu'un auteur
 * ne puisse pas annuler une decision de moderation sur son propre contenu, et
 * un privilege de colonne se verifie avant la RLS — la session de
 * l'administrateur est refusee comme les autres.
 *
 * 1. **La RPC `admin_set_content_hidden` (migration 0042)**, le bon chemin :
 *    `security definer`, donc au-dessus du revoke, et elle verifie
 *    `is_admin()` elle-meme. L'autorisation reste dans Postgres et
 *    `auth.uid()` garde un sens.
 * 2. **`service_role`** si la RPC n'est pas deployee (`PGRST202`) : c'est ce
 *    que 0033 preconisait, au prix d'une cle qui contourne tout le RLS.
 * 3. **Un message explicite** si aucun des deux n'est disponible, plutot
 *    qu'un 42501 illisible — meme convention que les ecrans mobiles qui
 *    nomment la migration manquante.
 *
 * `is_deleted` ne passe **jamais** par ici : ce privilege-la est accorde a
 * `authenticated`, et le trigger de 0041 doit lire `auth.uid()` pour reserver
 * la suppression au super administrateur.
 */
async function setHidden(
  targetType: "publication" | "commentaire",
  targetId: string,
  hidden: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_set_content_hidden", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_hidden: hidden,
  });

  if (!error) {
    // La RPC renvoie faux quand aucune ligne ne correspond : un update qui ne
    // matche rien reussit sans rien dire, piege documente cote mobile.
    return data === false
      ? { ok: false, message: "Ce contenu n'existe plus." }
      : { ok: true };
  }

  const rpcMissing =
    error.code === "PGRST202" || /admin_set_content_hidden/i.test(error.message ?? "");
  if (!rpcMissing) return { ok: false, message: describeError(error) };

  const service = createServiceClient();
  if (!service) {
    return {
      ok: false,
      message:
        "Masquage impossible : appliquez la migration 0042 (depot mobile), qui donne ce droit au back-office, ou renseignez SUPABASE_SERVICE_ROLE_KEY. Les migrations 0033/0035 ont retire ce droit aux sessions administrateur.",
    };
  }

  const table = targetType === "publication" ? "posts" : "post_comments";
  const { error: serviceError } = await service
    .from(table)
    .update({ is_hidden: hidden })
    .eq("id", targetId);
  return serviceError
    ? { ok: false, message: describeError(serviceError) }
    : { ok: true };
}

export async function setPostHidden(postId: string, hidden: boolean): Promise<ActionResult> {
  await requirePermission("moderation.manage");

  const result = await setHidden("publication", postId, hidden);
  if (!result.ok) return fail(result.message);

  await logAdminAction(hidden ? "hide_post" : "unhide_post", "post", postId);
  REFRESH();
  return ok(hidden ? "Publication masquee." : "Publication remise en ligne.");
}

export async function setPostDeleted(postId: string, deleted: boolean): Promise<ActionResult> {
  await requirePermission("moderation.validate");
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

  const result = await setHidden("commentaire", commentId, hidden);
  if (!result.ok) return fail(result.message);

  await logAdminAction(hidden ? "hide_comment" : "unhide_comment", "post_comment", commentId);
  REFRESH();
  return ok(hidden ? "Commentaire masque." : "Commentaire remis en ligne.");
}

export async function setCommentDeleted(
  commentId: string,
  deleted: boolean,
): Promise<ActionResult> {
  await requirePermission("moderation.validate");
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
  await requirePermission("moderation.validate");
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
  await requirePermission("moderation.validate");
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

/* ------------------------------------------------------------------ §12.2
 * Retrait d'un contenu signale : propose par un moderateur, valide par le
 * super administrateur (migration 0041).
 *
 * La machine a etats vit dans Postgres (`trg_enforce_report_workflow`) ; ce
 * qui vit ici, ce sont les **effets**, parce qu'ils touchent plusieurs tables
 * et le stockage. Un retrait n'a pas le meme sens selon la cible :
 *
 *   publication / commentaire  masquage reversible, puis is_deleted
 *   video                      pas de drapeau de masquage : suppression reelle
 *   profil joueur              is_visible = false, puis suspension du compte
 *   profil pro / utilisateur   pas de drapeau : suspension du compte
 *   scout day                  pas de drapeau : annulation de l'evenement
 *   message                    aucun effet automatique (messagerie chiffree,
 *                              moderation bornee — cf. migration 0022)
 */

/**
 * Masque la cible pendant l'instruction. Renvoie `true` seulement si quelque
 * chose a effectivement ete masque : un contenu deja invisible ne doit pas
 * etre « remis en ligne » par un refus, ce qui publierait ce que son auteur
 * avait retire lui-meme.
 */
async function quarantineTarget(targetType: string, targetId: string): Promise<boolean> {
  // La liste fait foi ici comme dans l'interface : sans ce garde, le
  // formulaire pourrait annoncer une mise en quarantaine que cette fonction
  // ne sait pas appliquer.
  if (!QUARANTINABLE.includes(targetType)) return false;
  const supabase = await createClient();

  if (targetType === "publication" || targetType === "commentaire") {
    const table = targetType === "publication" ? "posts" : "post_comments";
    const { data } = await supabase
      .from(table)
      .select("id, is_hidden, is_deleted")
      .eq("id", targetId)
      .maybeSingle();
    if (!data || data.is_hidden || data.is_deleted) return false;
    return (await setHidden(targetType, targetId, true)).ok;
  }

  if (targetType === "profil_joueur") {
    const { data } = await supabase
      .from("player_profiles")
      .select("id, is_visible")
      .eq("id", targetId)
      .maybeSingle();
    if (!data?.is_visible) return false;
    const { error } = await supabase
      .from("player_profiles")
      .update({ is_visible: false })
      .eq("id", targetId);
    return !error;
  }

  return false;
}


/** Leve la quarantaine posee par `quarantineTarget()`. */
async function liftQuarantine(targetType: string, targetId: string): Promise<void> {
  const supabase = await createClient();

  if (targetType === "publication" || targetType === "commentaire") {
    await setHidden(targetType, targetId, false);
    return;
  }
  if (targetType === "profil_joueur") {
    await supabase.from("player_profiles").update({ is_visible: true }).eq("id", targetId);
  }
}

/**
 * Applique le retrait valide. Renvoie un message d'erreur, ou `null` si tout
 * s'est bien passe. Postgres refusera de toute facon un retrait definitif
 * demande par un compte qui n'est pas super administrateur (0041).
 */
async function applyRemoval(
  adminId: string,
  targetType: string,
  targetId: string,
  action: ModerationAction,
): Promise<string | null> {
  const supabase = await createClient();

  if (action === "utilisateur_suspendu") {
    const owner = await targetOwner(targetType, targetId);
    if (!owner) return "Impossible d'identifier le compte a suspendre pour cette cible.";
    const result = await suspendProfile(adminId, owner, "Contenu signale — retrait valide.");
    return result.ok ? null : result.message;
  }

  switch (targetType) {
    // `is_deleted` reste sur la session administrateur : le trigger de 0041
    // lit `auth.uid()` pour reserver la suppression au super administrateur.
    // `is_hidden` passe au contraire par `setHidden()`, la colonne etant
    // revoquee a `authenticated` — d'ou les deux chemins.
    case "publication":
    case "commentaire": {
      const table = targetType === "publication" ? "posts" : "post_comments";
      if (action === "supprime") {
        const { error } = await supabase.from(table).update({ is_deleted: true }).eq("id", targetId);
        return error ? describeError(error) : null;
      }
      const hiddenResult = await setHidden(targetType, targetId, true);
      return hiddenResult.ok ? null : hiddenResult.message;
    }
    case "video": {
      const { data: video } = await supabase
        .from("player_videos")
        .select("id, storage_path")
        .eq("id", targetId)
        .maybeSingle();
      const { error } = await supabase.from("player_videos").delete().eq("id", targetId);
      if (error) return describeError(error);
      if (video?.storage_path) {
        await supabase.storage.from("player-videos").remove([video.storage_path]);
      }
      return null;
    }
    case "scout_day": {
      // « Retirer » un evenement, c'est l'annuler : la suppression effacerait
      // les inscriptions, et les inscrits doivent etre prevenus.
      const { error } = await supabase
        .from("scout_days")
        .update({ status: "annule" })
        .eq("id", targetId);
      return error ? describeError(error) : null;
    }
    default:
      // Profils et messages : le retrait passe par la suspension du compte,
      // seule mesure que le schema autorise ici.
      return "Cette cible ne se retire pas directement : choisissez la suspension du compte.";
  }
}

/** Le compte derriere une cible signalee, quand il y en a un. */
async function targetOwner(targetType: string, targetId: string): Promise<string | null> {
  const supabase = await createClient();

  switch (targetType) {
    case "profil_joueur":
    case "profil_professionnel":
    case "utilisateur":
      return targetId;
    case "publication": {
      const { data } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", targetId)
        .maybeSingle();
      return data?.author_id ?? null;
    }
    case "commentaire": {
      const { data } = await supabase
        .from("post_comments")
        .select("author_id")
        .eq("id", targetId)
        .maybeSingle();
      return data?.author_id ?? null;
    }
    case "video": {
      const { data } = await supabase
        .from("player_videos")
        .select("player_id")
        .eq("id", targetId)
        .maybeSingle();
      return data?.player_id ?? null;
    }
    // Un message signale : le compte a suspendre est son expediteur. Sans ce
    // cas, la seule mesure que `removalOptions()` propose pour un message —
    // la suspension — echouait sur « Impossible d'identifier le compte », et
    // un signalement de harcelement en messagerie n'avait aucune issue.
    case "message": {
      const { data } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("id", targetId)
        .maybeSingle();
      return data?.sender_id ?? null;
    }
    default:
      return null;
  }
}

/**
 * Etape 1 — le moderateur propose un retrait motive. Le contenu est masque
 * dans la foulee quand la cible s'y prete : un contenu signale cesse d'etre
 * visible pendant qu'on l'instruit.
 */
export async function proposeRemoval(
  reportId: string,
  // `string` et non `ModerationAction` : la valeur vient d'un `select` du
  // navigateur, donc elle est verifiee ici contre les retraits legitimes pour
  // cette cible, pas seulement typee.
  action: string,
  reason: string,
): Promise<ActionResult> {
  const admin = await requirePermission("moderation.manage");
  const motif = reason.trim();
  if (!motif) return fail("Motivez la proposition : le super administrateur la relira.");

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, status, target_type, target_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return fail("Signalement introuvable.");
  if (report.status !== "en_attente") {
    return fail("Ce signalement n'est plus en attente d'instruction.");
  }
  if (!removalOptions(report.target_type).includes(action as ModerationAction)) {
    return fail("Ce retrait ne s'applique pas a ce type de contenu.");
  }

  const quarantined = await quarantineTarget(report.target_type, report.target_id);

  const { data: proposed, error } = await supabase
    .from("reports")
    .update({
      status: "a_valider",
      proposed_action: action as ModerationAction,
      proposal_reason: motif,
      quarantined,
    })
    .eq("id", reportId)
    .select("id");
  if (error) {
    if (quarantined) await liftQuarantine(report.target_type, report.target_id);
    return fail(describeError(error));
  }
  if (!proposed?.length) {
    if (quarantined) await liftQuarantine(report.target_type, report.target_id);
    return fail("Aucune ligne modifiee : la proposition n'a pas ete enregistree.");
  }

  await logAdminAction("propose_report_removal", "report", reportId, {
    proposed_action: action,
    reason: motif,
    quarantined,
    proposed_by: admin.userId,
  });
  REFRESH();
  return ok(
    quarantined
      ? "Retrait propose. Le contenu est masque en attendant la validation."
      : "Retrait propose. Cette cible ne peut pas etre masquee : elle reste en ligne jusqu'a la decision.",
  );
}

/** Etape 2a — le super administrateur confirme : le retrait est applique. */
export async function confirmRemoval(reportId: string): Promise<ActionResult> {
  const admin = await requirePermission("moderation.validate");
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("id, status, target_type, target_id, proposed_action")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return fail("Signalement introuvable.");
  if (report.status !== "a_valider") return fail("Ce signalement n'attend pas de validation.");

  // L'effet d'abord : si Postgres le refuse, le signalement ne doit pas
  // annoncer un retrait qui n'a pas eu lieu.
  const failure = await applyRemoval(
    admin.userId,
    report.target_type,
    report.target_id,
    (report.proposed_action ?? "masque") as ModerationAction,
  );
  if (failure) return fail(failure);

  const { data: closed, error } = await supabase
    .from("reports")
    .update({ status: "traite" })
    .eq("id", reportId)
    .select("id");
  if (error) return fail(describeError(error));
  // Une ecriture filtree par la RLS reussit sur zero ligne : sans `.select()`,
  // le retrait serait applique et le signalement resterait ouvert, en silence.
  if (!closed?.length) {
    return fail(
      "Le retrait a ete applique mais le signalement n'a pas pu etre clos : aucune ligne modifiee.",
    );
  }

  await logAdminAction("confirm_report_removal", "report", reportId, {
    moderation_action: report.proposed_action,
    target_type: report.target_type,
    target_id: report.target_id,
  });
  REFRESH();
  return ok("Retrait valide et applique.");
}

/** Etape 2b — le super administrateur refuse : la quarantaine est levee. */
export async function refuseRemoval(reportId: string, reason: string): Promise<ActionResult> {
  await requirePermission("moderation.validate");
  const motif = reason.trim();
  if (!motif) return fail("Motivez le refus : il reste au journal des decisions.");

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, status, target_type, target_id, quarantined")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return fail("Signalement introuvable.");
  if (report.status !== "a_valider") return fail("Ce signalement n'attend pas de validation.");

  const { data: closed, error } = await supabase
    .from("reports")
    .update({ status: "rejete", decision_reason: motif, quarantined: false })
    .eq("id", reportId)
    .select("id");
  if (error) return fail(describeError(error));
  if (!closed?.length) return fail("Aucune ligne modifiee : le signalement n'a pas ete clos.");

  if (report.quarantined) await liftQuarantine(report.target_type, report.target_id);

  await logAdminAction("refuse_report_removal", "report", reportId, { reason: motif });
  REFRESH();
  return ok(
    report.quarantined
      ? "Retrait refuse : le contenu est remis en ligne."
      : "Retrait refuse.",
  );
}

/** Classement sans suite, avant toute proposition. Aucun contenu n'est retire. */
export async function dismissReport(reportId: string): Promise<ActionResult> {
  await requirePermission("moderation.manage");
  const supabase = await createClient();

  const { data: closed, error } = await supabase
    .from("reports")
    .update({ status: "rejete" })
    .eq("id", reportId)
    .select("id");
  if (error) return fail(describeError(error));
  if (!closed?.length) return fail("Aucune ligne modifiee : le signalement n'a pas ete classe.");

  await logAdminAction("dismiss_report", "report", reportId);
  REFRESH();
  return ok("Signalement classe sans suite.");
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
  return suspendProfile(admin.userId, profileId, reason);
}

/**
 * Le coeur de la suspension, sans controle de permission : appele par
 * `suspendUser()` (qui l'exige) et par la validation d'un retrait (qui exige
 * `moderation.validate`, plus forte). Le separer evite qu'un appel interne
 * redemande une permission deja verifiee — et surtout qu'il redirige.
 */
async function suspendProfile(
  adminId: string,
  profileId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  // Un seul appel la ou il y en avait trois : `profiles.is_active` n'est pas
  // ecrivable par une session administrateur (colonne revoquee a
  // `authenticated` par la migration 0025), et la RPC de 0044 aligne dans la
  // foulee le statut du profil metier — celui que lit le resolveur
  // d'onboarding mobile, sans lequel un joueur suspendu repasse la porte.
  const { data, error } = await supabase.rpc("admin_set_account_active", {
    p_profile_id: profileId,
    p_active: false,
    p_reason: reason.trim() || null,
  });
  // La suspension est la **seule** mesure de retrait offerte pour un compte
  // ou un message : si la RPC manque, ces signalements-la n'ont aucune issue.
  // Le dire, plutot que de renvoyer « function not found ».
  if (error) {
    return fail(describeRpcError(error, "admin_set_account_active", "Suspension indisponible"));
  }
  if (data === false) return fail("Compte introuvable.");

  await logAdminAction("suspend_user", "profile", profileId, { reason, by: adminId });
  REFRESH();
  return ok("Utilisateur suspendu.");
}
