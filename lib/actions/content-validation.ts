"use server";

import { revalidatePath } from "next/cache";

import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";

/**
 * §9 — validation d'une publication ou d'un commentaire du fil.
 *
 * MIGRATION MOBILE 0089. Un contenu depose par un utilisateur naît
 * `en_attente` : il n'est visible que de son auteur, grise, jusqu'a ce qu'un
 * **super administrateur** l'approuve. C'est le cycle des Scout Days (0040),
 * applique au fil a la demande du client.
 *
 * TROIS CHOSES QUI NE SE DECIDENT PAS ICI, et qu'il ne sert a rien de
 * contourner depuis ce fichier :
 *
 *  - le trigger `enforce_content_moderation` refuse la transition a quiconque
 *    n'est pas `is_super_admin()`. `requirePermission("content.validate")`
 *    ne fait que **cacher le geste** a un moderateur ordinaire plutot que de
 *    le laisser decouvrir la regle par un 42501 ;
 *  - le motif d'un refus est **obligatoire cote base**
 *    (`moderation_reason_required`) autant qu'ici : c'est la seule
 *    explication que l'auteur recevra, en notification ;
 *  - c'est le trigger `notify_content_moderation` qui previent l'auteur, pas
 *    ce code. Doubler avec une campagne enverrait deux fois le meme avis.
 *
 * ⚠️ On ecrit avec la session de l'administrateur (`createClient`), pas avec
 * `service_role` : `service_role` contourne tout le RLS **et rend
 * `auth.uid()` nul**, donc le trigger ne verrait plus qui valide et
 * `moderated_by` resterait vide. Le geste serait intracable — exactement ce
 * que la migration 0042 reprochait au masquage par cle de service.
 */

const REFRESH = () => revalidatePath("/[locale]/admin", "layout");

type Kind = "post" | "comment";

const TABLE: Record<Kind, "posts" | "post_comments"> = {
  post: "posts",
  comment: "post_comments",
};

/**
 * Une ecriture qui ne touche aucune ligne **reussit sans rien dire**.
 *
 * PostgREST n'echoue pas quand la RLS filtre la ligne visee : l'`update`
 * porte sur zero ligne, aucun trigger ne s'execute, et l'appelant recoit un
 * succes. Le back-office annoncerait « publication validee » sans que rien
 * n'ait bouge — le piege deja paye sur `professional_documents` cote mobile,
 * puis sur `scout_days` ici meme. `.select("id")` rend le silence audible.
 */
const touched = (rows: { id: string }[] | null) => (rows?.length ?? 0) > 0;

async function setStatus(
  kind: Kind,
  id: string,
  status: "approuve" | "refuse",
  reason?: string,
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  await requirePermission("content.validate");

  const motif = (reason ?? "").trim();
  if (status === "refuse" && !motif) {
    return fail(i18n.t("Indiquez le motif du refus : l'auteur le recevra tel quel."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE[kind])
    .update(
      status === "refuse"
        ? { moderation_status: status, moderation_reason: motif }
        : { moderation_status: status },
    )
    .eq("id", id)
    .select("id");

  if (error) {
    // La colonne n'existe pas : la migration 0089 n'est pas appliquee. On la
    // nomme plutot que de renvoyer un 42703 opaque — meme convention que les
    // ecrans mobiles.
    if (error.code === "42703" || error.code === "PGRST204") {
      return fail(
        i18n.t("Validation des contenus indisponible : la migration 0089_content_moderation.sql n'est pas appliquee sur ce projet."),
      );
    }
    // Le trigger refuse a qui n'est pas super administrateur. La permission
    // applicative a pu deriver du RBAC Postgres — on le dit clairement.
    if (error.code === "42501") {
      return fail(
        i18n.t("Refuse par Postgres : seul un super administrateur peut valider un contenu."),
      );
    }
    return fail(makeErrors(i18n.locale).describeError(error));
  }

  if (!touched(data)) {
    return fail(
      i18n.t("Aucune ligne modifiee : le contenu n'existe plus, ou le RLS ne vous laisse pas l'ecrire. Rien n'a ete valide."),
    );
  }

  await logAdminAction(
    `${status === "approuve" ? "approve" : "refuse"}_${kind}`,
    kind === "post" ? "post" : "comment",
    id,
    status === "refuse" ? { reason: motif } : { status },
  );
  REFRESH();

  if (status === "approuve") {
    return ok(
      kind === "post"
        ? i18n.t("Publication validee : elle est desormais visible dans le fil.")
        : i18n.t("Commentaire valide : il est desormais visible."),
    );
  }
  return ok(i18n.t("Contenu refuse : l'auteur est prevenu du motif."));
}

export async function approvePost(postId: string): Promise<ActionResult> {
  return setStatus("post", postId, "approuve");
}

export async function refusePost(postId: string, reason: string): Promise<ActionResult> {
  return setStatus("post", postId, "refuse", reason);
}

export async function approveComment(commentId: string): Promise<ActionResult> {
  return setStatus("comment", commentId, "approuve");
}

export async function refuseComment(commentId: string, reason: string): Promise<ActionResult> {
  return setStatus("comment", commentId, "refuse", reason);
}
