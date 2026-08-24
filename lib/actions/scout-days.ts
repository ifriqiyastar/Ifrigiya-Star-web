"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import type { RegistrationStatus, ScoutDayStatus } from "@/lib/labels";

/** Actions §12.3 — validation / moderation des Scout Days et des inscriptions. */

const REFRESH = () => revalidatePath("/admin", "layout");

const STATUS_MESSAGES: Record<ScoutDayStatus, string> = {
  brouillon: "Evenement repasse en brouillon.",
  publie: "Evenement publie.",
  annule: "Evenement annule.",
  cloture: "Evenement cloture.",
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

async function queueEventNotification(
  scoutDayId: string,
  title: string,
  body: string,
  createdBy: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_notification_campaigns").insert({
    title,
    body,
    target_type: "scout_day",
    target_value: scoutDayId,
    channels: ["in_app", "push"],
    status: "queued",
    created_by: createdBy,
  });
  if (error && error.code !== "42P01") console.error("queue scout day notification:", error.message);
}

/** Creation et modification complete d'un Scout Day. */
export async function saveScoutDay(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("events.manage");
  const supabase = await createClient();
  const id = text(formData, "id");
  const title = text(formData, "title");
  const eventDate = text(formData, "event_date");
  const location = text(formData, "location");
  const capacityRaw = text(formData, "capacity");
  const priceRaw = text(formData, "price_amount");
  const isPaid = formData.get("is_paid") === "on";

  if (!title || !eventDate || !location) {
    return fail("Titre, date et lieu sont obligatoires.");
  }
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const priceAmount = isPaid && priceRaw ? Number(priceRaw) : 0;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return fail("La capacite doit etre un entier positif.");
  }
  if (!Number.isFinite(priceAmount) || priceAmount < 0) return fail("Le prix est invalide.");

  const payload = {
    title,
    description: text(formData, "description"),
    event_date: eventDate,
    start_time: text(formData, "start_time"),
    end_time: text(formData, "end_time"),
    location,
    capacity,
    eligibility_criteria: text(formData, "eligibility_criteria")
      ? { description: text(formData, "eligibility_criteria") }
      : {},
    is_paid: isPaid,
    price_amount: priceAmount,
    price_currency: text(formData, "price_currency") ?? "TND",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: previous } = await supabase
      .from("scout_days")
      .select("title, event_date, start_time, location")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase.from("scout_days").update(payload).eq("id", id);
    if (error) return fail(describeError(error));
    await logAdminAction("update_scout_day", "scout_day", id, { previous, next: payload });
    if (
      previous &&
      (previous.event_date !== payload.event_date ||
        previous.start_time !== payload.start_time ||
        previous.location !== payload.location)
    ) {
      await queueEventNotification(
        id,
        `Modification du Scout Day : ${title}`,
        `La date, l'horaire ou le lieu de l'evenement a ete modifie. Consultez sa fiche.`,
        admin.userId,
      );
    }
    REFRESH();
    return ok("Scout Day mis a jour.");
  }

  const { data, error } = await supabase
    .from("scout_days")
    .insert({ ...payload, organizer_id: admin.userId, status: "brouillon" })
    .select("id")
    .single();
  if (error) return fail(describeError(error));
  await logAdminAction("create_scout_day", "scout_day", data.id, payload);
  REFRESH();
  return ok("Scout Day cree en brouillon.");
}

export async function setScoutDayStatus(
  scoutDayId: string,
  status: ScoutDayStatus,
): Promise<ActionResult> {
  const admin = await requirePermission("events.manage");
  const supabase = await createClient();

  const { error } = await supabase.from("scout_days").update({ status }).eq("id", scoutDayId);
  if (error) return fail(describeError(error));

  await logAdminAction(`scout_day_${status}`, "scout_day", scoutDayId, { status });
  if (status === "annule") {
    await queueEventNotification(
      scoutDayId,
      "Scout Day annule",
      "L'evenement auquel vous etiez inscrit a ete annule. Consultez sa fiche pour les details.",
      admin.userId,
    );
  }
  REFRESH();
  return ok(STATUS_MESSAGES[status]);
}

/**
 * Suppression d'un evenement : le schema autorise bien un DELETE admin sur
 * `scout_days`, et les inscriptions partent en cascade. Irreversible, donc
 * reserve aux evenements indesirables plutot qu'aux annulations (pour
 * lesquelles le statut `annule` existe et previent les inscrits).
 */
export async function deleteScoutDay(scoutDayId: string): Promise<ActionResult> {
  await requirePermission("events.manage");
  const supabase = await createClient();

  const { error } = await supabase.from("scout_days").delete().eq("id", scoutDayId);
  if (error) return fail(describeError(error));

  await logAdminAction("delete_scout_day", "scout_day", scoutDayId);
  REFRESH();
  return ok("Evenement supprime.");
}

export async function setRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus,
): Promise<ActionResult> {
  await requirePermission("events.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("scout_day_registrations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) return fail(describeError(error));

  await logAdminAction(`registration_${status}`, "scout_day_registration", registrationId, {
    status,
  });
  REFRESH();
  return ok(`Inscription : ${status}.`);
}
