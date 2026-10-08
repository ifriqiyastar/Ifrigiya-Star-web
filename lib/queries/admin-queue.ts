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
    href: "/admin/validations/joueurs",
    permission: "verifications.review",
  },
  {
    key: "professionals",
    section: "validations",
    href: "/admin/validations/professionnels",
    permission: "verifications.review",
  },
  {
    key: "documents",
    section: "validations",
    href: "/admin/validations/justificatifs",
    permission: "verifications.review",
  },
  {
    key: "identity",
    section: "validations",
    href: "/admin/validations/identite",
    permission: "verifications.review",
  },
  {
    key: "reports",
    section: "moderation",
    href: "/admin/moderation/signalements?statut=en_attente",
    permission: "moderation.manage",
  },
  {
    // Retraits proposes par un moderateur (migration mobile 0041) : seul un
    // super administrateur tranche, donc seul lui voit la ligne.
    key: "removals",
    section: "moderation",
    href: "/admin/moderation/signalements?statut=a_valider",
    permission: "moderation.validate",
  },
  {
    // §9 / migration mobile 0089 : une publication et un commentaire attendent
    // la validation d'un super administrateur. Comme les retraits, la file
    // n'est montree qu'a qui peut trancher — pointer un moderateur vers un
    // ecran ou tous les boutons lui seront refuses n'est pas une notification,
    // c'est une impasse.
    key: "posts",
    section: "moderation",
    href: "/admin/moderation/publications?etat=attente",
    permission: "content.validate",
  },
  {
    key: "comments",
    section: "moderation",
    href: "/admin/moderation/commentaires?etat=attente",
    permission: "content.validate",
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

const QUEUE_PERMISSIONS = new Set(QUEUES.map((queue) => queue.permission));

/**
 * Vrai si ces permissions ouvrent au moins une file — decide si la cloche du
 * bandeau a sa place dans l'en-tete. Un compte `editeur` (`blog.manage`
 * seul) n'en tient aucune : la cloche n'aurait jamais rien a montrer, ni
 * aujourd'hui ni apres l'ajout d'une future file, donc elle disparait plutot
 * que d'afficher en permanence « rien en attente ».
 */
export function hasQueueAccess(permissions: AdminPermission[]): boolean {
  return permissions.some((permission) => QUEUE_PERMISSIONS.has(permission));
}

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

  const [
    players,
    professionals,
    documents,
    identity,
    reports,
    removals,
    posts,
    comments,
    scoutDays,
    deletions,
  ] = await Promise.all([
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
      // ⚠️ Tant que 0089 n'est pas appliquee, la colonne n'existe pas et
      // PostgREST rend un 42703 : `count` vaut alors null, donc 0 ci-dessous.
      // La file disparait, elle ne casse pas la cloche.
      supabase
        .from("posts")
        .select("id", head)
        .eq("moderation_status", "en_attente")
        .eq("is_deleted", false),
      supabase
        .from("post_comments")
        .select("id", head)
        .eq("moderation_status", "en_attente")
        .eq("is_deleted", false),
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
    posts: posts.count ?? 0,
    comments: comments.count ?? 0,
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
    /**
     * Pastilles de la navigation : memes chiffres que la cloche.
     *
     * ⚠️ **Une pastille se pose sur l'ecran qui porte la file, pas sur son
     * voisin.** `signalements` additionnait les quatre files de moderation,
     * et c'est l'entree « Signalements » du rail qui la portait : une
     * publication en attente de validation s'y ajoutait, alors qu'elle
     * s'instruit dans « Publications ». On cliquait sur le chiffre et on
     * arrivait sur un ecran ou il n'y avait rien.
     *
     * `moderation` reste la somme des quatre — c'est le groupe replie, qui
     * doit continuer de dire ce qui attend sous lui. Depliee, chaque
     * sous-entree porte la sienne, et `NavMain` retire alors celle du parent
     * pour que le meme nombre ne soit pas imprime deux fois.
     */
    badges: {
      validations: counts.players + counts.professionals + counts.documents + counts.identity,
      // ⚠️ Meme correction que pour la moderation, et pour la meme raison
      // (signalee par le client) : un chiffre pose sur « Validations » dit
      // qu'il y a du travail, jamais lequel des quatre ecrans le porte — on
      // ouvrait les quatre pour trouver les deux dossiers. Chaque sous-entree
      // compte desormais la sienne ; le groupe garde le total, et `NavMain`
      // le retire quand il est deplie pour que le meme nombre ne soit pas
      // imprime deux fois.
      joueurs: counts.players,
      professionnels: counts.professionals,
      justificatifs: counts.documents,
      identite: counts.identity,
      moderation: counts.reports + counts.removals + counts.posts + counts.comments,
      signalements: counts.reports + counts.removals,
      publications: counts.posts,
      commentaires: counts.comments,
      scoutDays: counts.scoutDays,
    },
  };
}
