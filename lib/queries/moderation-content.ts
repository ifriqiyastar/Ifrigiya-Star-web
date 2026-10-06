import { createClient } from "@/lib/supabase/server";

/**
 * LA COUCHE DE LECTURE DE LA MODERATION, partagee par les quatre ecrans.
 *
 * Signalements, publications, commentaires et medias joueurs vivaient dans un
 * seul fichier de 1 800 lignes derriere `?vue=` ; ils sont maintenant quatre
 * routes. Ce qu'ils lisent, en revanche, est commun — et l'etait deja : la
 * recherche cote serveur a du etre corrigee trois fois parce qu'elle avait ete
 * ecrite trois fois. Elle est ici une seule.
 */

/** Taille d'une page de liste. */
export const PAGE_SIZE = 20;
/** Plafond des files d'attente. */
export const QUEUE_SIZE = 50;

export const REPORT_COLUMNS =
  "id, reporter_id, target_type, target_id, reason, status, moderation_action, handled_by, handled_at, created_at, proposed_by, proposed_at, proposed_action, proposal_reason, decision_reason, quarantined, context_conversation_id";

export const POST_COLUMNS =
  "id, author_id, content, media_type, media_url, is_hidden, is_deleted, created_at";
export const COMMENT_COLUMNS = "id, post_id, author_id, content, is_hidden, is_deleted, created_at";
/**
 * ⚠️ Les colonnes de 0093 sont demandées À PART. Les joindre à
 * `COMMENT_COLUMNS` ferait échouer toute la liste en `42703` sur un projet
 * où la migration n'est pas posée — le fil de discussion est un confort, il
 * ne doit pas coûter l'écran de modération.
 */
export const THREAD_COLUMNS = `${COMMENT_COLUMNS}, parent_comment_id, moderation_status`;

export type PostRow = {
  id: string;
  author_id: string;
  content: string | null;
  media_type: "aucun" | "photo" | "video" | "lien";
  media_url: string | null;
  is_hidden: boolean;
  is_deleted: boolean;
  created_at: string;
  moderation_status?: "en_attente" | "approuve" | "refuse";
  moderation_reason?: string | null;
  /** 0089, ecrits par le declencheur : qui a tranche, et quand. */
  moderated_by?: string | null;
  moderated_at?: string | null;
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_hidden: boolean;
  is_deleted: boolean;
  created_at: string;
  moderation_status?: "en_attente" | "approuve" | "refuse";
  moderation_reason?: string | null;
  /** 0089, ecrits par le declencheur : qui a tranche, et quand. */
  moderated_by?: string | null;
  moderated_at?: string | null;
  /** 0093. Null pour un commentaire racine ; un seul niveau d'imbrication. */
  parent_comment_id?: string | null;
};

/**
 * Le fil d'une publication : la racine, ses réponses, et celle qu'on modère.
 *
 * ⚠️ **Un moderateur ne peut pas juger une reponse seule.** « Bien joue » sous
 * une annonce et « bien joue » sous une insulte ne se moderent pas pareil, et
 * la liste ne montrait que le texte de la reponse. C'est le meme raisonnement
 * qui a fait ouvrir la publication en popup ; il vaut a plus forte raison ici,
 * ou le contexte immediat est le commentaire parent.
 */
export type ThreadComment = {
  id: string;
  authorName: string;
  authorId: string;
  content: string;
  createdAt: string;
  isReply: boolean;
  moderationStatus?: "en_attente" | "approuve" | "refuse";
  isHidden: boolean;
  isDeleted: boolean;
};

/**
 * Lit une table du fil **avec** les colonnes de la migration 0089, et retombe
 * sans elles si la migration n'est pas appliquee.
 *
 * ⚠️ Demander une colonne absente fait echouer **toute** la requete en
 * `42703` : sans ce repli, la liste entiere des publications disparaitrait du
 * back-office le jour ou l'on deploie l'ecran avant la migration. C'est le
 * meme raisonnement qui fait que la page Scout Days ne demande pas les
 * colonnes de 0040 dans sa liste principale.
 *
 * `available` dit a l'appelant s'il peut afficher l'etat de validation — un
 * ecran qui rend une colonne vide et un ecran qui rend « tout est valide » se
 * ressemblent trop.
 */
/**
 * Le strict necessaire du constructeur de requete PostgREST : `build` ne fait
 * que chainer des filtres. Le decrire ainsi evite deux `any` — et surtout
 * evite de devoir nommer le type genere de supabase-js, que ce depot n'a pas.
 */

type FeedQuery<T> = PromiseLike<{
  data: T[] | null;
  count: number | null;
  error: { code?: string } | null;
}> & {
  order(column: string, options?: { ascending?: boolean }): FeedQuery<T>;
  range(from: number, to: number): FeedQuery<T>;
  eq(column: string, value: unknown): FeedQuery<T>;
  ilike(column: string, pattern: string): FeedQuery<T>;
  not(column: string, operator: string, value: unknown): FeedQuery<T>;
  in(column: string, values: readonly unknown[]): FeedQuery<T>;
};

export async function selectWithModeration<T>(
  table: "posts" | "post_comments",
  columns: string,
  build: (q: FeedQuery<T>) => FeedQuery<T>,
): Promise<{ rows: T[]; count: number; available: boolean }> {
  const supabase = await createClient();
  // Un seul emplacement de conversion, et il est assume : supabase-js infere
  // ses types depuis un schema genere que ce depot ne versionne pas.
  const query = (select: string) =>
    supabase.from(table).select(select, { count: "exact" }) as unknown as FeedQuery<T>;

  // ⚠️ `moderated_by` et `moderated_at` VIENNENT AVEC, et pas par confort :
  // le journal d'administration a ete retire, donc ces deux colonnes — ecrites
  // par le declencheur de 0089 — sont la **seule** trace de qui a tranche et
  // quand. Sans elles l'ecran savait dire « en attente » et « refusee », mais
  // rien de ce qui avait ete valide : une decision prise ne se retrouvait
  // nulle part.
  const withCols = await build(
    query(`${columns}, moderation_status, moderation_reason, moderated_by, moderated_at`),
  );
  if (!withCols.error) {
    return { rows: withCols.data ?? [], count: withCols.count ?? 0, available: true };
  }
  if (withCols.error.code !== "42703") {
    return { rows: [], count: 0, available: true };
  }
  const plain = await build(query(columns));
  return { rows: plain.data ?? [], count: plain.count ?? 0, available: false };
}

/** La file d'attente d'une table du fil. Muette si 0089 n'est pas appliquee. */
export async function fetchPendingContent<T>(
  table: "posts" | "post_comments",
  columns: string,
): Promise<T[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select(`${columns}, moderation_status`)
    .eq("moderation_status", "en_attente")
    .eq("is_deleted", false)
    // Le plus recent en tete — demande du client (oct. 2026) : toutes les
    // listes, files comprises, se lisent du plus recent au plus ancien.
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as T[];
}


/**
 * CE QUI MET UNE PUBLICATION EN CAUSE — le « pourquoi cette ligne est devant
 * moi », en une requete pour toute la page.
 *
 * La liste montrait un etat (« Masquee », « Refusee ») et jamais sa cause.
 * Trois informations existaient et n'arrivaient pas a l'ecran :
 *
 * - `moderation_reason` est lu, type, passe a la popup… et jamais rendu dans
 *   la liste. Un refus est pourtant **motive obligatoirement** cote Postgres
 *   (`moderation_reason_required`), et le journal d'administration a ete
 *   retire : ce motif est la seule trace de la decision. Il fallait ouvrir la
 *   popup de chaque ligne pour le lire.
 * - Les signalements qui visent la publication n'apparaissaient nulle part.
 *   Une publication masquee a la suite d'un signalement se presentait
 *   exactement comme une publication masquee a la main.
 * - Un masquage direct, lui, n'enregistre aucun motif — le schema n'a pas la
 *   colonne. On le dit, plutot que de laisser croire a une trace perdue.
 *
 * ⚠️ Une requete pour la page entiere, jamais une par ligne — meme discipline
 * que les publications parentes des commentaires.
 */
export type ContentReport = {
  /** Le dossier le plus recent : c'est lui qu'on ouvre. */
  id: string;
  reason: string | null;
  status: string;
  /** Combien de signalements pesent sur cette publication en tout. */
  count: number;
};

export async function fetchContentReports(
  targetType: "publication" | "commentaire",
  ids: string[],
): Promise<Map<string, ContentReport>> {
  const found = new Map<string, ContentReport>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return found;

  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, target_id, reason, status, created_at")
    .eq("target_type", targetType)
    .in("target_id", unique)
    // Le plus recent d'abord : c'est celui que la ligne nomme, les suivants
    // ne font qu'incrementer le compte.
    .order("created_at", { ascending: false });

  for (const row of data ?? []) {
    const seen = found.get(row.target_id);
    if (seen) {
      seen.count += 1;
      continue;
    }
    found.set(row.target_id, {
      id: row.id,
      reason: row.reason,
      status: row.status,
      count: 1,
    });
  }
  return found;
}


/**
 * La migration 0089 est-elle posee ?
 *
 * Une seule sonde par rendu, partagee par le bandeau de filtres et par le
 * compteur des onglets. Demander `moderation_status` a un projet qui ne l'a
 * pas repond `42703` : proposer « En attente de validation » dans un filtre
 * qui ne peut rien ramener est pire que ne pas le proposer du tout.
 */
export async function hasModerationColumns(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .select("moderation_status", { head: true, count: "exact" })
    .limit(1);
  return error?.code !== "42703";
}


/**
 * Combien de signalements pesent sur chaque cible presente a l'ecran.
 *
 * ⚠️ **COMPTE SUR TOUTE LA TABLE, PAS SUR LA PAGE.** Le compteur etait calcule
 * a partir des vingt lignes affichees : une cible signalee cinq fois, repartie
 * entre la page 1 et la page 3, affichait « Niveau 1 » sur les deux. La
 * colonne Priorite etait donc aveugle au cas precis qu'elle existe pour
 * montrer — et la legende de la barre d'outils promettait « signalements
 * multiples » a partir d'une fenetre de vingt lignes. Une requete de plus,
 * bornee aux cibles deja presentes, et le chiffre redevient vrai.
 */
export async function fetchReportCounts(
  rows: { target_type: string; target_id: string }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!rows.length) return counts;

  const supabase = await createClient();
  const ids = [...new Set(rows.map((row) => row.target_id))];
  const { data } = await supabase.from("reports").select("target_type, target_id").in("target_id", ids);

  for (const row of data ?? []) {
    const key = `${row.target_type}:${row.target_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Une cible absente de la reponse — RLS, ou une ligne supprimee entre les
  // deux requetes — vaut au moins le signalement qui l'a fait apparaitre :
  // jamais zero, qui se lirait comme « jamais signale ».
  for (const row of rows) {
    const key = `${row.target_type}:${row.target_id}`;
    if (!counts.has(key)) counts.set(key, 1);
  }
  return counts;
}


export const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;

/**
 * Le texte tape par le moderateur, rendu inoffensif comme motif `ilike`.
 *
 * `%` et `_` sont des jokers cote Postgres : sans echappement, chercher
 * « 100% » ramene tout ce qui commence par « 100 ». Le `\` doit partir en
 * premier, sinon il echapperait les echappements ajoutes ensuite.
 */
export const likeTerm = (value: string) =>
  `%${value.replace(/\\/g, "\\\\").replace(/[%_]/g, (c) => `\\${c}`)}%`;
