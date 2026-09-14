import type { AdminTranslations } from "@/lib/i18n/admin-shared";
import { ACCOUNT_TARGETS } from "@/lib/moderation-targets";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/supabase/config";

/**
 * Ce qu'un signalement designe : resoudre la cible dans sa table, sans quoi
 * la file n'afficherait que des uuid.
 *
 * ⚠️ **Le contenu des messages prives ne se lit pas depuis le back-office**,
 * et c'est une decision, pas un manque. La RLS l'autoriserait — 0022 puis
 * 0047 ouvrent a la moderation le fil qu'un signalement designe — mais le
 * moderateur instruit sur **le motif** que le signaleur a ecrit, et sur lui
 * seul. Ne rebranchez pas `messages_readable` ici sans que le client l'ait
 * demande : ce serait rouvrir l'acces a des conversations privees.
 */

/* ------------------------------------------------------------------ blocages */

/**
 * Blocages portes par un compte, dans les deux sens.
 *
 * `user_blocks` est lisible par l'administration (`blocks_admin_read`) : le
 * blocage n'a aucun geste d'administration — c'est une decision d'utilisateur
 * — mais **combien de personnes ont bloque ce compte** est le seul indicateur
 * de recidive disponible quand le signalement ne porte sur aucun contenu.
 */
export type BlockSignal = {
  /** Nombre de comptes ayant bloque celui-ci. */
  received: number;
  /** Nombre de comptes que celui-ci a bloques. */
  issued: number;
  /** Identifiants des comptes qui l'ont bloque, pour reconnaitre le signaleur. */
  blockedBy: string[];
};

export async function fetchBlockSignals(
  accountIds: string[],
): Promise<Map<string, BlockSignal>> {
  const signals = new Map<string, BlockSignal>();
  const unique = [...new Set(accountIds.filter(Boolean))];
  if (!unique.length) return signals;

  const supabase = await createClient();
  const [received, issued] = await Promise.all([
    supabase.from("user_blocks").select("blocker_id, blocked_id").in("blocked_id", unique),
    supabase.from("user_blocks").select("blocker_id, blocked_id").in("blocker_id", unique),
  ]);

  const of = (id: string) => {
    const existing = signals.get(id);
    if (existing) return existing;
    const created: BlockSignal = { received: 0, issued: 0, blockedBy: [] };
    signals.set(id, created);
    return created;
  };

  for (const id of unique) of(id);
  for (const row of received.data ?? []) {
    const signal = of(row.blocked_id as string);
    signal.received += 1;
    signal.blockedBy.push(row.blocker_id as string);
  }
  for (const row of issued.data ?? []) of(row.blocker_id as string).issued += 1;

  return signals;
}

/* --------------------------------------------------- resolution des cibles */

export type ReportTarget = {
  /** Le texte du contenu, tronque. Nul pour un media ou un compte. */
  excerpt: string | null;
  /**
   * Ce qu'on affiche quand il n'y a **ni** texte **ni** media : une
   * publication en photo n'est pas « sans contenu », son contenu est l'image.
   */
  placeholder: string;
  mediaUrl: string | null;
  /** `lien` = media hebergee ailleurs (YouTube), qu'aucune balise locale ne lit. */
  mediaType: "photo" | "video" | "lien" | null;
  authorId: string | null;
  createdAt: string | null;
  /** Etat de moderation deja applique (« Masque », « Supprime »). */
  state: string[];
  href: string | null;
};

const EXCERPT_MAX = 400;

const excerptOf = (value: string | null | undefined) => {
  const text = (value ?? "").trim();
  if (!text) return null;
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;
};

/**
 * Resout chaque cible de signalement dans sa propre table — une requete par
 * type present dans la page, jamais une par ligne.
 *
 * Sans cela la fiche n'affichait qu'un uuid et renvoyait le moderateur vers
 * « l'onglet correspondant » : personne ne peut juger un contenu qu'il ne
 * voit pas. Les cibles introuvables restent absentes de la Map, et
 * l'interface le dit plutot que d'inventer.
 */
export async function fetchReportTargets(
  rows: { target_type: string; target_id: string }[],
  i18n: AdminTranslations,
): Promise<Map<string, ReportTarget>> {
  const targets = new Map<string, ReportTarget>();
  if (!rows.length) return targets;

  const byType = new Map<string, string[]>();
  for (const row of rows) {
    byType.set(row.target_type, [...(byType.get(row.target_type) ?? []), row.target_id]);
  }
  const ids = (type: string) => [...new Set(byType.get(type) ?? [])];

  const supabase = await createClient();
  const [posts, comments, videos, scoutDays, messages] = await Promise.all([
    ids("publication").length
      ? supabase
          .from("posts")
          .select(
            "id, author_id, content, media_type, media_url, is_hidden, is_deleted, created_at",
          )
          .in("id", ids("publication"))
      : { data: [] },
    ids("commentaire").length
      ? supabase
          .from("post_comments")
          .select("id, author_id, content, is_hidden, is_deleted, created_at")
          .in("id", ids("commentaire"))
      : { data: [] },
    ids("video").length
      ? supabase
          .from("player_videos")
          .select("id, player_id, title, youtube_url, storage_path, created_at")
          .in("id", ids("video"))
      : { data: [] },
    ids("scout_day").length
      ? supabase
          .from("scout_days")
          .select("id, organizer_id, title, event_date, status")
          .in("id", ids("scout_day"))
      : { data: [] },
    // Volontairement `public.messages` et **pas** la vue `messages_readable` :
    // seul l'expediteur est lu, pour savoir quel compte une suspension
    // viserait. Le texte reste chiffre dans `content_encrypted` et n'est
    // jamais demande — la vue, elle, le dechiffrerait.
    ids("message").length
      ? supabase
          .from("messages")
          .select("id, sender_id, is_deleted, created_at")
          .in("id", ids("message"))
      : { data: [] },
  ]);

  const flags = (row: { is_hidden?: boolean; is_deleted?: boolean }): string[] =>
    [
      row.is_hidden ? i18n.t("Masque") : null,
      row.is_deleted ? i18n.t("Supprime") : null,
    ].filter(
      (value): value is string => Boolean(value),
    );

  for (const row of posts.data ?? []) {
    // Meme resolution que l'onglet Publications : un chemin de stockage est
    // signe par le bucket public, une URL absolue est deja bonne.
    const mediaUrl =
      row.media_url && !row.media_url.startsWith("http")
        ? publicStorageUrl("post-media", row.media_url)
        : (row.media_url ?? null);

    targets.set(`publication:${row.id}`, {
      excerpt: excerptOf(row.content),
      placeholder: i18n.t("Publication sans texte ni media."),
      mediaUrl: row.media_type === "aucun" ? null : mediaUrl,
      mediaType: row.media_type === "photo" ? "photo" : row.media_type === "video" ? "video" : null,
      authorId: row.author_id,
      createdAt: row.created_at,
      state: flags(row),
      href: null,
    });
  }

  for (const row of comments.data ?? []) {
    targets.set(`commentaire:${row.id}`, {
      excerpt: excerptOf(row.content),
      placeholder: i18n.t("Commentaire vide."),
      mediaUrl: null,
      mediaType: null,
      authorId: row.author_id,
      createdAt: row.created_at,
      state: flags(row),
      href: null,
    });
  }

  for (const row of videos.data ?? []) {
    targets.set(`video:${row.id}`, {
      excerpt: excerptOf(row.title),
      placeholder: i18n.t("Video sans titre."),
      // Une video YouTube ne se lit pas dans une balise `<video>` : on la
      // presente en lien plutot que d'afficher un lecteur muet.
      mediaUrl: row.youtube_url ?? publicStorageUrl("player-videos", row.storage_path),
      mediaType: row.youtube_url ? "lien" : "video",
      authorId: row.player_id,
      createdAt: row.created_at,
      state: [],
      href: i18n.path(`/admin/utilisateurs/${row.player_id}`),
    });
  }

  for (const row of scoutDays.data ?? []) {
    targets.set(`scout_day:${row.id}`, {
      excerpt: excerptOf(row.title),
      placeholder: i18n.t("Evenement sans titre."),
      mediaUrl: null,
      mediaType: null,
      authorId: row.organizer_id,
      createdAt: row.event_date,
      state: row.status === "annule" ? [i18n.t("Annule")] : [],
      href: i18n.path(`/admin/scout-days/${row.id}`),
    });
  }

  for (const row of messages.data ?? []) {
    targets.set(`message:${row.id}`, {
      excerpt: null,
      placeholder: i18n.t(
        "Le contenu des messages prives n'est pas consultable depuis le back-office. Le motif du signalement est la seule piece du dossier ; la mesure disponible porte sur le compte de l'expediteur.",
      ),
      mediaUrl: null,
      mediaType: null,
      authorId: row.sender_id,
      createdAt: row.created_at,
      state: row.is_deleted ? [i18n.t("Supprime par son auteur")] : [],
      href: i18n.path(`/admin/utilisateurs/${row.sender_id}`),
    });
  }

  // Les cibles qui *sont* un compte : l'auteur, c'est la cible elle-meme.
  for (const type of ACCOUNT_TARGETS) {
    for (const id of ids(type)) {
      targets.set(`${type}:${id}`, {
        excerpt: null,
        placeholder: i18n.t("Le signalement vise le compte lui-meme, pas un contenu."),
        mediaUrl: null,
        mediaType: null,
        authorId: id,
        createdAt: null,
        state: [],
        href: i18n.path(`/admin/utilisateurs/${id}`),
      });
    }
  }

  return targets;
}

