"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { cleanCriteria, type EligibilityCriteria } from "@/lib/football";
import type { RegistrationStatus, ScoutDayStatus } from "@/lib/labels";

/** Actions §12.3 — validation / moderation des Scout Days et des inscriptions. */

const REFRESH = () => revalidatePath("/admin", "layout");

const STATUS_MESSAGES: Record<ScoutDayStatus, string> = {
  brouillon: "Evenement repasse en brouillon.",
  en_attente_validation: "Evenement remis en attente de validation.",
  publie: "Evenement publie.",
  annule: "Evenement annule.",
  cloture: "Evenement cloture.",
};

/** Une coordonnee, ou `null` : un champ vide ne doit pas devenir `0`. */
const coordinate = (formData: FormData, key: string) => {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
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

/**
 * Une ecriture qui ne touche aucune ligne **reussit sans rien dire**.
 *
 * PostgREST n'echoue pas quand la RLS filtre la ligne visee : l'`update` porte
 * sur zero ligne, aucun trigger ne s'execute, et l'appelant recoit un succes.
 * C'est le piege deja paye sur `professional_documents` cote mobile, et il est
 * particulierement vicieux ici : le back-office annoncait « Scout Day valide et
 * publie » sans que le statut ait bouge, et l'evenement n'apparaissait jamais
 * chez les joueurs. `.select("id")` force PostgREST a renvoyer les lignes
 * touchees, donc a rendre le silence audible.
 */
const touched = (rows: { id: string }[] | null) => (rows?.length ?? 0) > 0;

/**
 * Construit `scout_days.eligibility_criteria` a partir du formulaire.
 *
 * Les cles sont **exactement** celles que lit le controle d'eligibilite du
 * §8.2 et que produit le formulaire de l'application mobile. Le back-office
 * ecrivait jusqu'ici `{ description: "<texte libre>" }` : lisible a l'ecran,
 * mais invisible du filtre — un Scout Day cree ici n'excluait donc personne,
 * quoi que l'administrateur ait saisi.
 *
 * `cleanCriteria()` retire les entrees vides : un `{"age_min": null}` se lit
 * comme « un critere existe ».
 */
function criteriaFrom(formData: FormData): EligibilityCriteria {
  const number = (key: string) => {
    const raw = text(formData, key);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const list = (key: string) =>
    formData.getAll(key).map(String).map((value) => value.trim()).filter(Boolean);
  const country = text(formData, "country");
  const city = text(formData, "city");

  return cleanCriteria({
    age_min: number("age_min"),
    age_max: number("age_max"),
    positions: list("positions"),
    levels: list("levels"),
    countries: country ? [country] : undefined,
    cities: city ? [city] : undefined,
    free_agent_only: formData.get("free_agent_only") === "on",
    other: text(formData, "other") ?? undefined,
  });
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
  // `chk_scout_day_price` exige un montant strictement positif des que
  // l'evenement est payant : on le dit en francais plutot qu'en 23514.
  if (isPaid && priceAmount <= 0) {
    return fail("Un evenement payant demande un prix superieur a zero.");
  }

  const payload = {
    title,
    description: text(formData, "description"),
    event_date: eventDate,
    start_time: text(formData, "start_time"),
    end_time: text(formData, "end_time"),
    location,
    // Le point sur la carte va **par paire** : `chk_scout_day_coords` refuse
    // une latitude sans longitude. Vide des deux cotes = pas de point.
    location_address: text(formData, "location_address"),
    latitude: coordinate(formData, "latitude"),
    longitude: coordinate(formData, "longitude"),
    capacity,
    eligibility_criteria: criteriaFrom(formData),
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
    const { data: updated, error } = await supabase
      .from("scout_days")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) return fail(describeError(error));
    if (!touched(updated)) {
      return fail("Aucune ligne modifiee : l'evenement n'existe plus, ou le RLS ne vous laisse pas l'ecrire.");
    }
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

  // `scout_days.organizer_id` reference `professional_profiles(id)`, pas
  // `profiles(id)` : l'evenement est organise par un professionnel, que
  // l'administrateur designe. Poser `admin.userId` ici violait la cle
  // etrangere. On verifie la fiche avant l'insert pour renvoyer un message
  // clair plutot qu'un 23503.
  const organizerId = String(formData.get("organizer_id") ?? "").trim();
  if (!organizerId) return fail("Selectionnez le professionnel organisateur de l'evenement.");

  const { data: organizer } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("id", organizerId)
    .maybeSingle();
  if (!organizer) {
    return fail(
      "Ce compte n'a pas de fiche professionnelle valide : il ne peut pas organiser un Scout Day.",
    );
  }

  const { data, error } = await supabase
    .from("scout_days")
    .insert({ ...payload, organizer_id: organizerId, status: "brouillon" })
    .select("id")
    .single();
  if (error) {
    // Le schema d'origine reserve la creation d'un Scout Day au professionnel
    // concerne (`organizer_id = auth.uid() and is_validated_professional()`) :
    // un administrateur n'etant ni l'un ni l'autre, l'insert est refuse tant
    // que la policy dediee n'est pas deployee. On nomme la migration au lieu
    // de renvoyer un refus RLS opaque — meme convention que les ecrans mobiles.
    if (error.code === "42501") {
      return fail(
        "Creation refusee par le RLS Postgres : appliquez la migration 202608240002_admin_authoring_policies.sql, qui autorise l'administration a creer un Scout Day. Sans elle, seule la fiche du professionnel organisateur peut le faire.",
      );
    }
    return fail(describeError(error));
  }
  await logAdminAction("create_scout_day", "scout_day", data.id, {
    ...payload,
    organizerId,
    createdByAdmin: admin.userId,
  });
  REFRESH();
  return ok("Scout Day cree en brouillon.");
}

/**
 * Changement de statut generique (annuler, cloturer, depublier, remettre en
 * relecture).
 *
 * La publication passe par `events.validate` et non `events.manage` : depuis
 * la migration 0040, seul un super administrateur peut amener un Scout Day a
 * `publie`, et `is_super_admin()` le refuserait de toute facon cote Postgres.
 * Demander la bonne permission ici evite d'aller chercher un 42501 pour
 * l'apprendre. Preferer `validateScoutDay()` pour une validation depuis la
 * file d'attente : elle trace le geste sous son propre nom dans le journal.
 */
export async function setScoutDayStatus(
  scoutDayId: string,
  status: ScoutDayStatus,
): Promise<ActionResult> {
  const admin = await requirePermission(
    status === "publie" ? "events.validate" : "events.manage",
  );
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scout_days")
    .update({ status })
    .eq("id", scoutDayId)
    .select("id");
  if (error) return fail(describeError(error));
  if (!touched(data)) {
    return fail("Aucune ligne modifiee : l'evenement n'existe plus, ou le RLS ne vous laisse pas l'ecrire.");
  }

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
 * §8.1 — validation d'un Scout Day soumis par un professionnel.
 *
 * Le trigger `trg_enforce_scout_day_validation` (migration 0040) horodate la
 * validation et signe `validated_by` lui-meme : on ne pousse donc que le
 * statut. Il notifie aussi l'organisateur — inutile de doubler avec une
 * campagne, qui viserait les inscrits et non l'organisateur.
 */
export async function validateScoutDay(scoutDayId: string): Promise<ActionResult> {
  await requirePermission("events.validate");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scout_days")
    .update({ status: "publie" })
    .eq("id", scoutDayId)
    .select("id");
  if (error) return fail(describeError(error));
  if (!touched(data)) {
    return fail(
      "Aucune ligne modifiee : l'evenement n'existe plus, ou le RLS ne vous laisse pas l'ecrire. Rien n'a ete publie.",
    );
  }

  await logAdminAction("validate_scout_day", "scout_day", scoutDayId, { status: "publie" });
  REFRESH();
  return ok("Scout Day valide et publie.");
}

/**
 * Refus motive : l'evenement retourne en brouillon chez son organisateur avec
 * le motif, qu'il recevra en notification. Le motif est obligatoire cote base
 * (`validation_reason_required`) autant qu'ici — c'est la seule explication
 * que le professionnel obtiendra.
 */
export async function refuseScoutDay(
  scoutDayId: string,
  reason: string,
): Promise<ActionResult> {
  await requirePermission("events.validate");
  const motif = reason.trim();
  if (!motif) return fail("Indiquez le motif du refus : l'organisateur le recevra tel quel.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scout_days")
    .update({ status: "brouillon", validation_reason: motif })
    .eq("id", scoutDayId)
    .select("id");
  if (error) return fail(describeError(error));
  if (!touched(data)) {
    return fail("Aucune ligne modifiee : l'evenement n'existe plus, ou le RLS ne vous laisse pas l'ecrire.");
  }

  await logAdminAction("refuse_scout_day", "scout_day", scoutDayId, { reason: motif });
  REFRESH();
  return ok("Evenement refuse : l'organisateur est prevenu du motif.");
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
