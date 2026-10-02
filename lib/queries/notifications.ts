import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";

export const CAMPAIGNS_PAGE_SIZE = 20;

/** Les quatre etats que la table accepte (contrainte `check` de 202608240001). */
export const CAMPAIGN_STATUSES = ["sent", "failed", "processing", "queued"] as const;
/** Les quatre types de cible acceptes par la meme contrainte. */
export const CAMPAIGN_TARGETS = ["all", "role", "user", "scout_day"] as const;

/**
 * Le canal email est-il reellement diffusable ?
 *
 * Deux conditions, et les deux se verifient a l'execution plutot que d'etre
 * decretees par une constante : il faut **une cle d'envoi** et il faut que la
 * **fonction de resolution des destinataires** existe en base. Proposer la
 * case sans l'une des deux enregistrerait une campagne « email » que personne
 * ne recoit, et le journal l'afficherait comme reussie.
 *
 * ⚠️ La sonde de la fonction ne l'appelle pas : `admin_broadcast_recipients`
 * renvoie des adresses, et une page de composition n'a aucune raison de les
 * lire. Elle interroge le catalogue de PostgREST, qui repond `PGRST202`
 * quand la fonction est absente — l'appel se fait donc avec une cible
 * volontairement invalide, dont le refus (`22023`) prouve que la fonction
 * existe sans rien divulguer.
 */
export type ChannelState = {
  /** Le canal peut-il etre coche ou decoche sur cet ecran ? */
  selectable: boolean;
  /** Pourquoi il ne peut pas l'etre : cle absente, migration, ou droits. */
  reason: "" | "unconfigured" | "migration" | "permission";
};

const UNAVAILABLE = (reason: ChannelState["reason"]): ChannelState => ({
  selectable: false,
  reason,
});

/**
 * L'etat des deux canaux optionnels.
 *
 * Chacun n'est proposé que si le mecanisme existe reellement derriere —
 * proposer une case qui n'agit sur rien enregistrerait une campagne dont le
 * journal mentirait. Les deux sondes interrogent le catalogue de PostgREST
 * plutot que la base : `PGRST202` veut dire « fonction absente », et c'est la
 * seule chose qu'on cherche a savoir.
 *
 * ⚠️ Les sondes appellent la vraie fonction avec une **cible volontairement
 * invalide**. Les deux la refusent (`22023`) avant d'ecrire ou de lire quoi
 * que ce soit : la sonde ne diffuse rien et ne divulgue aucune adresse.
 *
 * `canChoose` vient de l'appelant : le choix des canaux est un geste de super
 * administrateur, comme la validation d'un Scout Day ou d'une publication.
 */
export async function fetchChannelStates(canChoose: boolean): Promise<{
  push: ChannelState;
  email: ChannelState;
}> {
  const supabase = await createClient();

  const [pushProbe, emailProbe] = await Promise.all([
    supabase.rpc("admin_broadcast_notification", {
      p_title: "sonde",
      p_body: "sonde",
      p_target_type: "__sonde__",
      p_target_value: null,
      p_push: true,
    }),
    process.env.RESEND_API_KEY
      ? supabase.rpc("admin_broadcast_recipients", {
          p_target_type: "__sonde__",
          p_target_value: null,
        })
      : Promise.resolve({ error: null }),
  ]);

  const absent = (error: { code?: string; message?: string } | null, name: string) =>
    error?.code === "PGRST202" || new RegExp(name, "i").test(error?.message ?? "");

  // L'ordre des refus compte : dire « droits insuffisants » a quelqu'un dont
  // l'installation n'a pas la migration l'enverrait demander un role qui ne
  // changerait rien.
  const push = absent(pushProbe.error, "admin_broadcast_notification")
    ? UNAVAILABLE("migration")
    : canChoose
      ? { selectable: true, reason: "" as const }
      : UNAVAILABLE("permission");

  const email = !process.env.RESEND_API_KEY
    ? UNAVAILABLE("unconfigured")
    : absent(emailProbe.error, "admin_broadcast_recipients")
      ? UNAVAILABLE("migration")
      : canChoose
        ? { selectable: true, reason: "" as const }
        : UNAVAILABLE("permission");

  return { push, email };
}

/**
 * Combien de comptes ont un appareil joignable.
 *
 * ⚠️⚠️ **Ne jamais lire `push_tokens` directement.** La table n'a qu'une
 * policy `push_tokens_manage_own` et la migration mobile 0023 dit pourquoi il
 * n'y a **pas** de policy d'administration : un jeton permet d'envoyer une
 * notification a quelqu'un. La session du back-office est donc filtree comme
 * les autres et lisait une liste vide — l'ecran affichait « 0 compte
 * joignable » sur toutes les installations, et en concluait par ecrit que
 * personne ne recevrait de push. Ce n'etait pas une mesure, c'etait le RLS.
 *
 * `admin_push_reach()` ne rend qu'un entier. `null` quand la fonction n'est
 * pas encore en place : l'ecran doit alors ecrire « — », jamais « 0 ».
 */
export async function fetchPushReach(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_push_reach");
  if (error) return null;
  return Number(data ?? 0);
}

export type CampaignRow = {
  id: string;
  title: string;
  body: string;
  target_type: string;
  target_value: string | null;
  channels: string[] | null;
  status: string;
  recipient_count: number | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};

const CAMPAIGN_COLUMNS =
  "id, title, body, target_type, target_value, channels, status, recipient_count, error_message, created_by, created_at";

/**
 * Le texte tape par l'administrateur, rendu inoffensif **a l'interieur d'un
 * `or=(...)` PostgREST** — deux echappements successifs, et l'ordre compte.
 *
 * 1. `%` et `_` sont les jokers de `ilike` : sans `\` devant, chercher
 *    « 100% » ramene tout ce qui commence par « 100 » ;
 * 2. `or=(...)` reserve la virgule et les parentheses, donc la valeur doit
 *    etre entre guillemets — et PostgREST **deshabille un niveau de `\`** en
 *    sortant des guillemets, ce qui mangerait l'echappement de l'etape 1.
 *
 * Mesure contre le projet reel plutot que deduite : `title.ilike."%\%%"`
 * renvoie les 7 lignes de la table (l'echappement a ete perdu), tandis que
 * `title.ilike."%\\%%"` en renvoie 0 (le `%` est bien devenu litteral). Une
 * virgule, une parenthese ou un guillemet passent alors sans erreur d'analyse.
 */
export function orLikeTerm(value: string) {
  const pattern = `%${value.replace(/\\/g, "\\\\").replace(/[%_]/g, (char) => `\\${char}`)}%`;
  return `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Le journal des campagnes, filtre **dans la requete**.
 *
 * Le filtre appartient au SQL et non a une passe sur le resultat : sinon
 * `count` — qui alimente la pagination et le pied du panneau — ignorerait la
 * recherche, et un terme present a la 200e campagne resterait introuvable.
 */
export async function fetchCampaignJournal(params: {
  page: number;
  statut?: string;
  cible?: string;
  q?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("admin_notification_campaigns")
    .select(CAMPAIGN_COLUMNS, { count: "exact" });

  if (params.statut) query = query.eq("status", params.statut);
  if (params.cible) query = query.eq("target_type", params.cible);
  if (params.q) {
    const term = orLikeTerm(params.q);
    query = query.or(`title.ilike.${term},body.ilike.${term}`);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range((params.page - 1) * CAMPAIGNS_PAGE_SIZE, params.page * CAMPAIGNS_PAGE_SIZE - 1);

  const rows = (data ?? []) as unknown as CampaignRow[];

  // Qui a expedie : depuis le retrait du journal d'administration, la colonne
  // `created_by` est la seule trace de l'auteur d'une diffusion. Une requete
  // pour la page entiere, jamais une par ligne.
  const authors = await fetchProfilesByIds(
    rows.map((row) => row.created_by ?? "").filter(Boolean),
  );

  return { rows, total: count ?? 0, error, authors };
}

/**
 * Les mesures qui coiffent le journal.
 *
 * Toutes portent la **meme fenetre de 30 jours**, sauf les echecs a relancer,
 * qui sont un reste de travail et n'ont donc pas de date de peremption. Le
 * total historique n'est plus une tuile : il vit dans la pastille du titre.
 *
 * ⚠️ Aucune mesure ne se calcule sur la page affichee. « Destinataires servis
 * sur les campagnes affichees » changeait de valeur en tournant la page et en
 * posant un filtre — un indicateur ne peut pas dependre de la pagination.
 */
export async function fetchCampaignMetrics() {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [window, failed, total] = await Promise.all([
    supabase
      .from("admin_notification_campaigns")
      .select("status, recipient_count")
      .gte("created_at", since.toISOString())
      .limit(1000),
    supabase
      .from("admin_notification_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    supabase.from("admin_notification_campaigns").select("id", { count: "exact", head: true }),
  ]);

  const rows = window.data ?? [];
  const sent30d = rows.filter((row) => row.status === "sent").length;
  const failed30d = rows.filter((row) => row.status === "failed").length;
  const decided = sent30d + failed30d;

  return {
    campaigns30d: rows.length,
    recipients30d: rows.reduce((sum, row) => sum + Number(row.recipient_count ?? 0), 0),
    sent30d,
    failed30d,
    // `null` et non zero quand rien n'a ete diffuse : « 0 % » se lirait comme
    // un echec generalise la ou il n'y a simplement rien eu a envoyer.
    successRate: decided ? sent30d / decided : null,
    failedTotal: failed.count ?? 0,
    total: total.count ?? 0,
  };
}

/**
 * De quoi composer : la volumetrie de chaque segment, les cibles nominatives
 * et la portee push reelle.
 *
 * Les comptages de segment reprennent **exactement** les conditions de
 * `admin_broadcast_notification` — comptes actifs uniquement — sans quoi le
 * chiffre affiche avant l'envoi ne serait pas celui qui part.
 */
export async function fetchBroadcastAudience() {
  const supabase = await createClient();

  // ⚠️ Les comptes ne sont plus charges ici. Le composeur en portait jusqu'a
  // deux mille, serialises dans la page a chaque ouverture, pour un envoi
  // nominatif qu'on fait rarement — et un `<select>` de deux mille lignes ne
  // se parcourait de toute facon pas. `searchAccounts()` les cherche au fil
  // de la frappe.
  const [scoutDays, activeAccounts, activePlayers, activePros, registrations] =
    await Promise.all([
      supabase.from("scout_days").select("id, title, event_date").order("event_date", { ascending: false }).limit(1000),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("role", "player"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("role", "professional"),
      supabase.from("scout_day_registrations").select("scout_day_id, status").limit(5000),
    ]);

  const registrationsByEvent = new Map<string, number>();
  for (const row of registrations.data ?? []) {
    if (["annule", "refuse"].includes(row.status as string)) continue;
    const key = row.scout_day_id as string;
    registrationsByEvent.set(key, (registrationsByEvent.get(key) ?? 0) + 1);
  }

  return {
    scoutDays: scoutDays.data ?? [],
    registrationsByEvent,
    audiences: {
      all: activeAccounts.count ?? 0,
      players: activePlayers.count ?? 0,
      professionals: activePros.count ?? 0,
    },
    activeAccounts: activeAccounts.count ?? 0,
  };
}
