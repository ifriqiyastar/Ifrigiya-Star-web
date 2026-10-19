import type { AdminPermission } from "@/lib/auth";
import { plural, type AdminDictionary } from "@/lib/i18n/admin-shared";
import { countUnsettledScoutDayRegistrations } from "@/lib/queries/scout-day-payments";
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
    // ⚠️⚠️ L'ARGENT QUI ATTEND, demande client (oct. 2026). Un joueur
    // s'inscrit a un evenement payant depuis l'application mobile et
    // l'administration n'en savait rien : l'inscription n'a aucune ligne dans
    // `payments` tant que l'encaissement n'est pas saisi — l'etat normal d'un
    // reglement en especes — donc le releve paraissait a jour. Il fallait
    // penser a aller voir.
    //
    // ⚠️ Reservee a `finance.manage`, c'est-a-dire au super administrateur et
    // au role « finance ». Comme les retraits et les publications, une file
    // n'est montree qu'a qui peut la traiter.
    key: "collect",
    section: "finances",
    href: "/admin/finances/paiements",
    permission: "finance.manage",
  },
  {
    // L'autre moitie : un paiement deja enregistre mais pas confirme attend
    // lui aussi un geste. Deux lignes plutot qu'un total, parce que les deux
    // gestes ne sont pas le meme et ne se font pas au meme endroit de l'ecran.
    key: "paymentsPending",
    section: "finances",
    href: "/admin/finances/paiements?statut=en_attente",
    permission: "finance.manage",
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
 * Les dix comptages, **en un seul aller-retour** quand la base connait
 * `admin_queue_counts` (`202610140001_admin_fast_reads.sql`).
 *
 * POURQUOI. C'est la lecture la plus souvent rejouee du back-office : une fois
 * par rendu du layout — donc a chaque chargement d'ecran et a chaque
 * `router.refresh()` d'`AutoRefresh` — plus une fois toutes les dix secondes
 * pour le sondage de la cloche (`/admin/file-attente`). En dix requetes
 * separees vers un projet Supabase distant, la rafale a ete mesuree entre
 * 0,6 s (connexions chaudes) et 6,8 s (connexions froides), pour dix
 * `count(*)` que Postgres execute en quelques millisecondes. Le cout etait le
 * reseau, pas la base.
 *
 * ⚠️ **Le chemin d'origine reste la reference.** La fonction est absente d'un
 * projet ou la migration n'a pas ete appliquee, et l'ecran doit continuer de
 * compter : on retombe alors sur les dix requetes. Un echec pour une autre
 * raison y retombe aussi — au pire on paye ce qu'on payait hier.
 */
async function countQueues(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_queue_counts");

  if (!error && data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    // ⚠️⚠️ UNE CLE MANQUANTE N'EST PLUS LUE COMME ZERO. Elle l'etait, et
    // c'etait tenable tant que la fonction et ce tableau avaient toujours ete
    // ecrits ensemble. Les deux files de finances
    // (`202610190001_queue_payments_to_collect.sql`) ont change cela : contre
    // une base qui porte la version PRECEDENTE de la fonction, « de l'argent
    // attend » se serait annonce « rien n'attend » — une file silencieusement
    // vide, c'est-a-dire exactement le defaut qu'elle vient corriger. On
    // repasse donc par le chemin d'origine, qui compte tout, plutot que de
    // faire confiance a une reponse incomplete.
    const complete = QUEUES.every((queue) => row[queue.key] !== undefined);
    if (complete) {
      return Object.fromEntries(
        QUEUES.map((queue) => [queue.key, Number(row[queue.key] ?? 0)]),
      );
    }
  }

  return countQueuesOneByOne();
}

/**
 * Le comptage d'origine, une requete par file.
 *
 * Conserve tel quel : c'est lui qui tourne sur un projet dont la base ignore
 * `admin_queue_counts`, et c'est lui qui porte la tolerance aux migrations
 * mobiles absentes — une colonne inconnue rend `42703`, donc `count` null,
 * donc zero.
 */
async function countQueuesOneByOne(): Promise<Record<string, number>> {
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
    paymentsPending,
    collect,
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
      supabase.from("payments").select("id", head).eq("status", "en_attente"),
      // ⚠️ La seule file qui ne se compte pas en une requete : « aucune ligne
      // liee ne satisfait ce predicat » n'est pas exprimable en PostgREST, donc
      // l'exclusion se fait en deux temps. Elle est donc deliberement **a la
      // fin** de cette rafale, qui n'est deja que le chemin de repli.
      countUnsettledScoutDayRegistrations(),
    ]);

  return {
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
    paymentsPending: paymentsPending.count ?? 0,
    collect,
  };
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
  const counts = await countQueues();

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
      // Le groupe « Paiements et revenus » et l'ecran qui porte reellement les
      // deux gestes — le meme chiffre, puisque l'ecran est unique : `NavMain`
      // retire celui du parent quand le groupe est deplie.
      finances: counts.collect + counts.paymentsPending,
      paiements: counts.collect + counts.paymentsPending,
    },
  };
}
