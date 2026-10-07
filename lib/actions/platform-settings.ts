"use server";

import { revalidatePath } from "next/cache";

import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { SCOUT_DAY_NOTICE_MAX, SCOUT_DAY_NOTICE_MIN } from "@/lib/platform-settings";
import { createClient } from "@/lib/supabase/server";

/**
 * Le preavis minimum exige d'un organisateur de Scout Day (demande client du
 * 2026-10-07).
 *
 * `events.validate` et non `events.manage` : c'est une regle de plateforme
 * qui s'impose a tous les professionnels, posee par la meme main que la
 * validation des evenements, et la policy `platform_settings_write` demande
 * `is_super_admin()`. Les deux gardes repondent donc pareil — un bouton visible
 * est un bouton que l'action et la base acceptent toutes les deux.
 */
export async function setScoutDayMinNotice(formData: FormData): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  const admin = await requirePermission("events.validate");

  const raw = String(formData.get("days") ?? "").trim();
  const days = Number(raw);
  if (
    !raw ||
    !Number.isInteger(days) ||
    days < SCOUT_DAY_NOTICE_MIN ||
    days > SCOUT_DAY_NOTICE_MAX
  ) {
    return fail(
      i18n.t("Indiquez un nombre entier de jours, entre {min} et {max}.", {
        min: SCOUT_DAY_NOTICE_MIN,
        max: SCOUT_DAY_NOTICE_MAX,
      }),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .upsert(
      {
        id: true,
        scout_day_min_notice_days: days,
        updated_at: new Date().toISOString(),
        updated_by: admin.userId,
      },
      { onConflict: "id" },
    )
    // ⚠️ `.select("id")` : mesure sur un Postgres jetable, l'ecriture d'un
    // compte qui n'est pas super administrateur **reussit sans rien changer** —
    // la RLS filtre la ligne, l'update porte sur zero ligne, et PostgREST
    // repond « succes ». Sans ce controle l'ecran annoncerait un preavis pose
    // que la base n'a jamais enregistre.
    .select("id");

  if (error) {
    if (error.code === "42P01") {
      return fail(
        i18n.t("Reglage indisponible : appliquez la migration 202610070001_scout_day_min_notice.sql. Sans elle, aucun preavis n'est exige des organisateurs."),
      );
    }
    // ⚠️ Le cas qui arrive vraiment : `requirePermission()` laisse passer un
    // code que le referentiel RBAC ne connait pas encore (degrade ouvert,
    // documente dans CLAUDE.md), mais la policy `platform_settings_write`,
    // elle, demande `is_super_admin()`. L'ecart se lit « 42501 » et le message
    // generique parlerait d'une policy manquante, ce qui enverrait chercher
    // au mauvais endroit.
    if (error.code === "42501" && /platform_settings/.test(error.message)) {
      return fail(
        i18n.t("Reglage refuse par la base de donnees : il est reserve au super administrateur. Rien n'a ete enregistre."),
      );
    }
    return fail(makeErrors(i18n.locale).describeError(error));
  }
  if (!data?.length) {
    return fail(
      i18n.t("Aucune ligne modifiee : la base de donnees reserve ce reglage au super administrateur. Rien n'a ete enregistre."),
    );
  }

  // La cible du geste est le reglage lui-meme : `platform_settings` n'a qu'une
  // ligne, identifiee par un booleen, et il n'y a donc pas d'identifiant a
  // tracer. Le journal est retire depuis la migration mobile 0045 — l'appel
  // reste en place, comme partout ailleurs, pour qu'il se remplisse de
  // lui-meme s'il revient.
  await logAdminAction("set_scout_day_min_notice", "platform_setting", "scout_day_min_notice_days", {
    days,
  });
  revalidatePath("/[locale]/admin", "layout");

  return ok(
    days > 0
      ? i18n.t("Preavis enregistre : un organisateur ne peut plus deposer un Scout Day a moins de {days} jour(s).", { days })
      : i18n.t("Preavis desactive : un organisateur peut deposer un Scout Day pour n'importe quelle date a venir."),
  );
}
