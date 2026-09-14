import type { AdminPermission } from "@/lib/auth";
import { plural, type AdminDictionary } from "@/lib/i18n/admin-shared";
import { createClient } from "@/lib/supabase/server";

/**
 * Une ligne de la file de travail de l'administration.
 *
 * La cloche du bandeau **ne lit pas `public.notifications`** : cette table est
 * la boite de reception des utilisateurs. `notifications_select_own` porte bien
 * `or public.is_admin()`, donc Postgres laisserait un administrateur tout lire —
 * mais un back-office n'a pas a afficher « X vous a envoye un message » avec le
 * nom du destinataire, pas plus qu'il n'ouvre leurs conversations privees. Meme
 * regle que pour `messages_readable` dans `lib/queries/moderation.ts` : le droit
 * technique existe, l'usage est refuse.
 *
 * Ce que la cloche montre a la place, c'est ce qui attend une decision de
 * l'administration — et cela se compte, ligne par ligne, dans les tables
 * metier.
 */
export type AdminTask = {
  key: string;
  /** Libelle au singulier / pluriel deja resolu, ex. « 2 dossiers joueurs a valider ». */
  label: string;
  /** Section d'origine, **traduite**, affichee en sous-ligne. */
  section: string;
  /**
   * La meme section sous forme de cle stable. Le rail regroupe les files par
   * elle : filtrer sur le libelle marchait tant que le back-office etait
   * monolingue, et comptait zero validation des que l'ecran passait en
   * anglais, la chaine comparee etant devenue « Validations » traduit.
   */
  group: keyof AdminDictionary["queue"]["sections"];
  href: string;
  count: number;
};

export type NextAdminEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  location: string | null;
};

/**
 * Definition d'une file : son compte, sa destination, et le droit qui la
 * revele.
 *
 * `key` et `section` designent le dictionnaire plutot que de porter le texte :
 * le type ci-dessous force chaque file a avoir ses deux formes (singulier et
 * pluriel) dans `queue`, donc ajouter une file sans son libelle casse le
 * build.
 */
type QueueKey = Exclude<keyof AdminDictionary["queue"], "sections">;

type QueueSpec = {
  key: QueueKey;
  section: keyof AdminDictionary["queue"]["sections"];
  href: string;
  permission: AdminPermission;
};

/**
 * Files d'attente du back-office, dans l'ordre du cahier des charges §12.
 * L'ordre de ce tableau est celui de la cloche.
 */
const QUEUES: QueueSpec[] = [
  {
    key: "players",
    section: "validations",
    href: "/admin/validations?vue=joueurs",
    permission: "verifications.review",
  },
  {
    key: "professionals",
    section: "validations",
    href: "/admin/validations?vue=professionnels",
    permission: "verifications.review",
  },
  {
    key: "documents",
    section: "validations",
    href: "/admin/validations?vue=justificatifs",
    permission: "verifications.review",
  },
  {
    key: "identity",
    section: "validations",
    href: "/admin/validations?vue=identite",
    permission: "verifications.review",
  },
  {
    key: "reports",
    section: "moderation",
    href: "/admin/moderation?vue=signalements&statut=en_attente",
    permission: "moderation.manage",
  },
  {
    // Retraits proposes par un moderateur (migration mobile 0041) : seul un
    // super administrateur tranche, donc seul lui voit la ligne.
    key: "removals",
    section: "moderation",
    href: "/admin/moderation?vue=signalements&statut=a_valider",
    permission: "moderation.validate",
  },
  {
    key: "scoutDays",
    section: "scoutDays",
    href: "/admin/scout-days?statut=en_attente_validation",
    permission: "events.manage",
  },
  {
    key: "deletions",
    section: "accounts",
    href: "/admin/utilisateurs?suppression=oui",
    permission: "users.read",
  },
];

/**
 * Compte les files d'attente une seule fois pour le layout : la cloche et les
 * pastilles de la navigation lisent le meme resultat, donc ne peuvent pas se
 * contredire.
 *
 * Les taches sont filtrees par permission — pointer un moderateur vers un ecran
 * que `requirePermission()` lui refusera n'est pas une notification, c'est une
 * impasse.
 */
export async function fetchAdminQueue(
  permissions: AdminPermission[],
  dict: AdminDictionary,
) {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [players, professionals, documents, identity, reports, removals, scoutDays, deletions] =
    await Promise.all([
      supabase
        .from("player_profiles")
        .select("id", head)
        .eq("status", "en_attente_validation"),
      supabase
        .from("professional_profiles")
        .select("id", head)
        .eq("status", "en_attente_validation"),
      supabase.from("professional_documents").select("id", head).eq("status", "en_attente"),
      supabase.from("identity_verifications").select("id", head).eq("status", "en_attente"),
      supabase.from("reports").select("id", head).eq("status", "en_attente"),
      supabase.from("reports").select("id", head).eq("status", "a_valider"),
      supabase.from("scout_days").select("id", head).eq("status", "en_attente_validation"),
      supabase.from("profiles").select("id", head).not("deletion_requested_at", "is", null),
    ]);

  const counts: Record<string, number> = {
    players: players.count ?? 0,
    professionals: professionals.count ?? 0,
    documents: documents.count ?? 0,
    identity: identity.count ?? 0,
    reports: reports.count ?? 0,
    removals: removals.count ?? 0,
    scoutDays: scoutDays.count ?? 0,
    deletions: deletions.count ?? 0,
  };

  const granted = new Set(permissions);
  const tasks: AdminTask[] = QUEUES.filter(
    (queue) => granted.has(queue.permission) && counts[queue.key] > 0,
  ).map((queue) => ({
    key: queue.key,
    label: plural(counts[queue.key], dict.queue[queue.key]),
    section: dict.queue.sections[queue.section],
    group: queue.section,
    href: queue.href,
    count: counts[queue.key],
  }));

  return {
    tasks,
    /** Pastilles de la navigation : memes chiffres que la cloche. */
    badges: {
      validations: counts.players + counts.professionals + counts.documents + counts.identity,
      signalements: counts.reports + counts.removals,
      scoutDays: counts.scoutDays,
    },
  };
}

/**
 * Prochain rendez-vous utile au rail. La lecture est evitee pour les roles qui
 * n'ont pas acces aux Scout Days : le raccourci ne doit jamais pointer vers un
 * ecran que l'administrateur ne peut pas ouvrir.
 */
export async function fetchNextAdminEvent(
  permissions: AdminPermission[],
): Promise<NextAdminEvent | null> {
  if (!permissions.includes("events.manage")) return null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("scout_days")
    .select("id, title, event_date, start_time, location")
    .eq("status", "publie")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as NextAdminEvent | null) ?? null;
}
