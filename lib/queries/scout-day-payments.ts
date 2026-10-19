import { createClient } from "@/lib/supabase/server";

/**
 * L'evenement auquel une inscription payante se rattache — assez de champs
 * pour le **reconnaitre sans quitter l'ecran**.
 *
 * ⚠️ Le titre seul ne suffisait pas. Deux Scout Days peuvent porter le meme
 * nom, et sur telephone la colonne de l'evenement etait carrement masquee :
 * l'administrateur encaissait une inscription sans savoir laquelle. Ce sont
 * la date, le lieu et le tarif qui identifient un evenement, donc ils
 * voyagent avec lui.
 *
 * ⚠️ Toutes ces colonnes sont **verifiees contre la base reelle** (sonde
 * PostgREST du 2026-10-19 : une colonne absente repond `42703` avant meme la
 * RLS, une colonne presente repond `42501` sur `is_admin()`). Aucune ne vient
 * d'une migration optionnelle, donc elles tiennent dans le meme embed sans
 * exposer la lecture a un `42703`.
 */
export type ScoutDayDetail = {
  id: string;
  title: string | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  locationAddress: string | null;
  capacity: number | null;
  status: string | null;
  organizerId: string | null;
  isPaid: boolean | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

/** Les colonnes de l'evenement, ecrites une fois pour les deux lectures. */
const SCOUT_DAY_COLUMNS =
  "id, title, event_date, start_time, end_time, location, location_address, capacity, status, organizer_id, is_paid, price_amount, price_currency";

/**
 * Normalise l'evenement embarque.
 *
 * PostgREST rend un objet pour une relation un-vers-un, mais deduit parfois un
 * tableau ; on accepte les deux plutot que de dependre de cette deduction.
 */
function toScoutDayDetail(embedded: unknown): ScoutDayDetail | null {
  const event = (Array.isArray(embedded) ? embedded[0] : embedded) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!event?.id) return null;
  return {
    id: event.id as string,
    title: (event.title as string | null) ?? null,
    eventDate: (event.event_date as string | null) ?? null,
    startTime: (event.start_time as string | null) ?? null,
    endTime: (event.end_time as string | null) ?? null,
    location: (event.location as string | null) ?? null,
    locationAddress: (event.location_address as string | null) ?? null,
    capacity: (event.capacity as number | null) ?? null,
    status: (event.status as string | null) ?? null,
    organizerId: (event.organizer_id as string | null) ?? null,
    isPaid: (event.is_paid as boolean | null) ?? null,
    priceAmount: (event.price_amount as number | null) ?? null,
    priceCurrency: (event.price_currency as string | null) ?? null,
  };
}

/**
 * De `payments.scout_day_registration_id` vers l'evenement.
 *
 * ⚠️ UNE SEULE REQUETE, par embed PostgREST, et c'est la raison d'etre de ce
 * fichier. Le chemin naturel en demande deux — les inscriptions, puis les
 * evenements — et la regle du depot est que ce qu'un ecran coute se compte en
 * ALLERS-RETOURS, pas en requetes : la base est distante et le lien lent. Un
 * `select` imbrique les ramene ensemble.
 *
 * ⚠️ DEGRADE OUVERT. Si la relation n'est pas lisible (migration absente,
 * droit retire), on rend une table vide : la ligne de paiement s'affiche comme
 * avant, sans le nom de l'evenement. Jamais un ecran blanc pour un libelle
 * d'appoint. Meme regle que les vignettes de `fetchProfilesByIds`.
 */
export async function fetchScoutDaysByRegistration(
  registrationIds: (string | null)[],
): Promise<Map<string, ScoutDayDetail>> {
  const unique = [...new Set(registrationIds.filter(Boolean))] as string[];
  const byRegistration = new Map<string, ScoutDayDetail>();
  if (!unique.length) return byRegistration;

  const supabase = await createClient();
  const { data } = await supabase
    .from("scout_day_registrations")
    .select(`id, scout_day:scout_days(${SCOUT_DAY_COLUMNS})`)
    .in("id", unique);

  for (const row of data ?? []) {
    const event = toScoutDayDetail(row.scout_day);
    if (event) byRegistration.set(row.id as string, event);
  }
  return byRegistration;
}

/** Une inscription a un evenement payant dont l'encaissement n'est pas saisi. */
export type UnsettledRegistration = {
  registrationId: string;
  playerId: string;
  registeredAt: string | null;
  /** Statut de l'INSCRIPTION (confirme, en attente…), pas de l'evenement. */
  status: string | null;
  scoutDay: ScoutDayDetail;
};

/**
 * Les statuts qui comptent comme « un encaissement existe deja ».
 *
 * `rembourse` et `echoue` n'en sont pas : une inscription remboursee est de
 * nouveau a encaisser, et un paiement echoue n'a rien encaisse du tout.
 */
const LIVE_PAYMENT_STATUSES = ["reussi", "active_manuellement", "en_attente"];

/**
 * Les inscriptions qui portent deja un paiement vivant.
 *
 * Lue a part parce que PostgREST ne sait pas exprimer « aucune ligne liee ne
 * satisfait ce predicat » : l'exclusion se fait donc en deux temps, et les
 * deux appelants (la liste et le comptage de la cloche) partagent la meme
 * definition plutot que d'en entretenir deux.
 */
async function fetchSettledRegistrationIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("scout_day_registration_id")
    .not("scout_day_registration_id", "is", null)
    .in("status", LIVE_PAYMENT_STATUSES);

  return [
    ...new Set((data ?? []).map((row) => row.scout_day_registration_id as string)),
  ].filter(Boolean);
}

/**
 * Combien d'inscriptions restent a encaisser — le chiffre de la cloche.
 *
 * ⚠️ CE N'EST PAS LE CHEMIN NORMAL. `admin_queue_counts()` rend ce comptage
 * avec les autres, en un seul aller-retour
 * (`202610190001_queue_payments_to_collect.sql`). Cette fonction est le repli
 * du repli : elle ne tourne que sur un projet dont la base ignore la fonction,
 * et elle coute deux allers-retours de plus par rendu de layout. Elle existe
 * pour que la file soit comptee quand meme plutot que de valoir zero en
 * silence — une file d'argent a encaisser qui s'annonce vide est pire que
 * lente.
 */
export async function countUnsettledScoutDayRegistrations(): Promise<number> {
  const supabase = await createClient();
  const settledIds = await fetchSettledRegistrationIds();

  let query = supabase
    .from("scout_day_registrations")
    .select("id, scout_day:scout_days!inner(is_paid)", { count: "exact", head: true })
    .eq("scout_day.is_paid", true)
    .neq("status", "annule");

  if (settledIds.length) query = query.not("id", "in", `(${settledIds.join(",")})`);

  const { count } = await query;
  return count ?? 0;
}

/**
 * Les inscriptions a encaisser : evenement payant, aucune ligne de paiement
 * vivante.
 *
 * ⚠️⚠️ POURQUOI CETTE LECTURE EXISTE. L'ecran « Paiements » liste la table des
 * PAIEMENTS. Un joueur inscrit a un evenement payant dont personne n'a encore
 * saisi l'encaissement — l'etat NORMAL d'un reglement en especes — n'y a donc
 * aucune ligne, et par consequent aucun bouton. Le releve paraissait vide
 * alors qu'il restait de l'argent a encaisser. C'est la moitie manquante de
 * l'ecran, pas un doublon de la fiche de l'evenement.
 *
 * ⚠️ LE FILTRE EST DANS LA REQUETE, jamais sur la page deja paginee : sinon
 * une inscription ancienne ne serait jamais trouvee. On lit d'abord les
 * inscriptions deja reglees, puis on les exclut cote serveur.
 *
 * ⚠️ DEGRADE OUVERT : toute lecture en echec rend une liste vide, et l'ecran
 * « Paiements » s'affiche comme avant.
 */
export async function fetchUnsettledScoutDayRegistrations(
  limit: number,
): Promise<{ rows: UnsettledRegistration[]; truncated: boolean }> {
  const supabase = await createClient();
  const settledIds = await fetchSettledRegistrationIds();

  let query = supabase
    .from("scout_day_registrations")
    .select(`id, player_id, registered_at, status, scout_day:scout_days!inner(${SCOUT_DAY_COLUMNS})`)
    .eq("scout_day.is_paid", true)
    .neq("status", "annule")
    .order("registered_at", { ascending: false })
    .limit(limit + 1);

  if (settledIds.length) query = query.not("id", "in", `(${settledIds.join(",")})`);

  const { data } = await query;
  const all = data ?? [];
  // ⚠️ On demande limit + 1 pour SAVOIR qu'il en reste, plutot que de couper
  // en silence : le panneau le dit, et renvoie vers la fiche de l'evenement.
  const truncated = all.length > limit;

  const rows: UnsettledRegistration[] = [];
  for (const row of all.slice(0, limit)) {
    const event = toScoutDayDetail(row.scout_day);
    if (!event) continue;
    rows.push({
      registrationId: row.id as string,
      playerId: row.player_id as string,
      registeredAt: (row.registered_at as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      scoutDay: event,
    });
  }
  return { rows, truncated };
}
