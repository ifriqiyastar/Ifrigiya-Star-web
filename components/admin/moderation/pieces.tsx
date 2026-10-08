import Link from "next/link";
import { SearchIcon, XIcon } from "lucide-react";

import { AutoFilterForm, FilterSearchIcon } from "@/components/admin/auto-filter-form";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import type { PreviewComment, PreviewPost } from "@/components/admin/post-preview-dialog";
import { getAdminI18n } from "@/lib/i18n/admin";
import { WHY_ICON, WHY_TONE, type WhyLine } from "@/lib/moderation-why";
import { REPORTABLE_TYPE, REPORT_STATUS } from "@/lib/labels";
import type { CommentRow, ContentReport, PostRow } from "@/lib/queries/moderation-content";
import { storageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/**
 * Les pieces communes aux quatre ecrans de moderation.
 *
 * Elles etaient inline dans la page unique ; la separation en quatre routes
 * les rendrait sinon copiees quatre fois — ce qui est exactement ce qui avait
 * produit trois recherches cote client et trois compteurs faux.
 */

/** Les quatre vues, qui sont maintenant quatre routes. */
export const MODERATION_VUES = ["signalements", "publications", "commentaires", "medias"] as const;
export type Vue = (typeof MODERATION_VUES)[number];

/** Le chemin d'une vue, sans le prefixe de langue. */
export const vuePath = (vue: Vue) => `/admin/moderation/${vue}` as const;

/**
 * Ce qui met une publication en cause, resolu **une fois** et serialisable.
 *
 * ⚠️ La popup est un composant client : elle ne peut ni `await` le
 * dictionnaire ni recevoir un composant d'icone. Le bandeau etait donc rendu
 * sur la ligne et absent de la popup — c'est-a-dire que le motif manquait
 * precisement la ou la decision se prend. Cette fonction rend des donnees
 * pures ; `ContentWhy` les dessine cote serveur, `PostPreviewDialog` les
 * redessine cote client a partir de `kind`.
 */
export async function whyLines({
  report,
  hidden,
  moderationStatus,
  moderationReason,
  moderatedBy,
  moderatedAt,
}: {
  report?: ContentReport;
  hidden: boolean;
  moderationStatus?: "en_attente" | "approuve" | "refuse";
  moderationReason?: string | null;
  /** Nom deja resolu du decideur — la ligne ne porte qu'un identifiant. */
  moderatedBy?: string | null;
  moderatedAt?: string | null;
}): Promise<WhyLine[]> {
  const i18n = await getAdminI18n();
  const lines: WhyLine[] = [];

  if (report) {
    lines.push({
      key: "report",
      kind: "report",
      label:
        report.count > 1
          ? i18n.t("{0} signalements", { "0": report.count })
          : i18n.t("1 signalement"),
      detail: report.reason?.trim() || i18n.t("Aucun motif enregistre"),
      href: i18n.path(`/admin/moderation/signalements/${report.id}`),
    });
  }

  // La trace de la decision : qui a tranche, quand. Elle vaut pour un refus
  // **comme pour une validation** — c'est la seconde qui manquait, et avec
  // elle toute possibilite de retrouver ce qu'on avait valide.
  const decidedBy = moderatedBy?.trim();
  const decidedAt = moderatedAt ? i18n.format.formatDateTime(moderatedAt) : null;
  const trace = [decidedAt, decidedBy ? i18n.t("par {0}", { "0": decidedBy }) : null]
    .filter(Boolean)
    .join("  ");

  if (moderationStatus === "refuse") {
    lines.push({
      key: "refus",
      kind: "refus",
      label: i18n.t("Refus motive"),
      detail: [moderationReason?.trim() || i18n.t("Aucun motif enregistre"), trace]
        .filter(Boolean)
        .join("  "),
    });
  } else if (moderationStatus === "approuve" && (decidedAt || decidedBy)) {
    // ⚠️ Seulement quand la trace existe. `moderation_status` vaut
    // « approuve » **d'office** sur tout ce qui precede 0089 (la migration
    // approuve l'existant), sans decideur ni date : afficher « Validee » sur
    // ces lignes-la ferait passer un defaut de migration pour une decision.
    lines.push({
      key: "validation",
      kind: "validation",
      label: i18n.t("Validee"),
      detail: trace,
    });
  } else if (hidden && !report) {
    // Masquage a la main : il n'y a pas de colonne de motif, et le dire vaut
    // mieux que de laisser chercher une trace qui n'existe pas.
    lines.push({
      key: "masque",
      kind: "masque",
      label: i18n.t("Retire du flux par l'administration"),
      detail: i18n.t("Un masquage direct n'enregistre pas de motif : seule une decision prise sur signalement en porte un."),
    });
  }

  return lines;
}

/**
 * Le bandeau de mise en cause, pose AVANT le texte de la publication.
 *
 * L'ordre n'est pas decoratif : le motif doit arriver avant le contenu, comme
 * le fil d'un commentaire arrive avant la decision qu'on prend dessus. Rien
 * ne s'affiche quand rien ne vise la publication — et c'est une reponse, pas
 * un vide : la liste montre tout le fil, la plupart des lignes n'ont aucune
 * raison particuliere d'etre regardees.
 */
export async function ContentWhy({
  lines,
  className,
  ...source
}: {
  /** Deja resolues par l'appelant quand la popup les recoit aussi. */
  lines?: WhyLine[];
  report?: ContentReport;
  hidden: boolean;
  moderationStatus?: "en_attente" | "approuve" | "refuse";
  moderationReason?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  className?: string;
}) {
  const i18n = await getAdminI18n();
  const resolved = lines ?? (await whyLines(source));

  if (!resolved.length) return null;

  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-border bg-accent/40 px-3 py-2", className)}>
      {resolved.map((line) => {
        const Icon = WHY_ICON[line.kind];
        return (
          // `items-start` et non `items-baseline` : sous 1024 px le detail se
          // replie sur plusieurs lignes, et une icone centree sur le bloc
          // flottait a hauteur de la deuxieme. Elle se cale sur la premiere.
          <div key={line.key} className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 text-xs">
            <Icon className={cn("mt-0.5 size-3.5 shrink-0", WHY_TONE[line.kind])} />
            {/* ⚠️ C'EST LE COMPTE QUI EST LE LIEN, pas un « Ouvrir le
                signalement » pose a cote. Ce libelle mesurait ~150 px et etait
                `shrink-0` : dans la cellule commentaire du tableau, qui tombe a
                ~130 px a 768 px, il ne pouvait pas tenir et debordait **sous la
                colonne voisine** — un debordement invisible a
                `document.scrollWidth`, comme le `<select>` de 21 px. Cliquer ce
                qui nomme le dossier est de toute facon plus direct. */}
            {line.href ? (
              <Link
                href={line.href}
                title={i18n.t("Ouvrir le signalement")}
                className="font-semibold text-brand underline underline-offset-2"
              >
                {line.label}
              </Link>
            ) : (
              <span className="font-semibold">{line.label}</span>
            )}
            <span className="min-w-0 flex-1 text-muted-foreground">{line.detail}</span>
          </div>
        );
      })}
    </div>
  );
}


/** Le refus, cote interface : meme dialogue pour une publication et un commentaire. */
export function RefuseContentDialog({
  action,
  i18n,
}: {
  action: (reason: string) => Promise<import("@/lib/actions/result").ActionResult>;
  i18n: Awaited<ReturnType<typeof getAdminI18n>>;
}) {
  return (
    <ReasonDialog
      action={action}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          <XIcon className="size-3.5" />
          {i18n.t("Refuser")}
        </button>
      }
      title={i18n.t("Refuser ce contenu")}
      description={i18n.t("Le contenu reste invisible des autres utilisateurs. Son auteur recoit le motif en notification, tel quel.")}
      label={i18n.t("Motif du refus")}
      placeholder={i18n.t("Propos deplaces, coordonnees personnelles, hors sujet…")}
      submitLabel={i18n.t("Refuser le contenu")}
    />
  );
}


/**
 * Les donnees de la popup, construites au meme endroit pour la file d'attente
 * et pour la liste : deux constructions divergeraient au premier changement.
 */
export function previewOf(
  row: PostRow,
  author: { id?: string; email?: string | null; avatar_url?: string | null } | undefined,
  name: string,
  mediaUrl: string | null,
  /**
   * Ce que la popup ne peut pas calculer elle-meme : la date mise en forme (la
   * mettre en forme dans le navigateur ferait dependre le rendu du fuseau du
   * poste, donc diverger de celui du serveur a l'hydratation) et le bandeau de
   * mise en cause, qui demande le dictionnaire et une lecture des
   * signalements.
   */
  extra: { createdAtLabel?: string; why?: WhyLine[] } = {},
): PreviewPost {
  return {
    id: row.id,
    content: row.content,
    mediaType: row.media_type,
    mediaUrl,
    createdAt: row.created_at,
    isHidden: row.is_hidden,
    isDeleted: row.is_deleted,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason ?? null,
    createdAtLabel: extra.createdAtLabel,
    why: extra.why,
    author: {
      id: row.author_id,
      name,
      email: author?.email ?? null,
      avatarUrl: author?.avatar_url ?? null,
    },
  };
}

/**
 * Les donnees de la popup pour un COMMENTAIRE, construites au meme endroit
 * pour la file d'attente et pour la liste — meme regle que `previewOf`.
 */
export function commentPreviewOf(
  row: CommentRow,
  author: { email?: string | null; avatar_url?: string | null } | undefined,
  name: string,
  extra: { createdAtLabel?: string; why?: WhyLine[]; replyTo?: string | null } = {},
): PreviewComment {
  return {
    id: row.id,
    content: row.content,
    isHidden: row.is_hidden,
    isDeleted: row.is_deleted,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason ?? null,
    createdAtLabel: extra.createdAtLabel,
    why: extra.why,
    replyTo: extra.replyTo,
    author: {
      id: row.author_id,
      name,
      email: author?.email ?? null,
      avatarUrl: author?.avatar_url ?? null,
    },
  };
}

/**
 * L'URL servable du media d'une publication.
 *
 * ⚠️ La colonne porte tantot un chemin, tantot une URL **publique complete**
 * — et `post-media` est prive depuis la migration mobile 0051, donc cette URL
 * publique repond 400. C'est pour ca que ni la vignette de la liste, ni
 * l'image de la popup, ni « Ouvrir le media » ne montraient quoi que ce soit.
 * `storageUrl()` ramene les deux formes au chemin et passe par la route qui
 * signe avec la session administrateur.
 */
export const mediaUrlOf = (row: PostRow) => storageUrl("post-media", row.media_url);


/**
 * Le bandeau de filtres — UN SEUL POUR LES QUATRE ONGLETS.
 *
 * Il y en avait deux. Un `<form>` GET maison dans le bloc d'en-tete pour les
 * signalements — `<select>` natifs, indice clavier « Entree », validation a la
 * soumission — et `FilterBar` pour les publications et les commentaires :
 * composant client, `Select` de Base UI, navigation des le changement, pose
 * *dans* le panneau sous son titre. Meme ecran, meme geste, deux composants,
 * deux emplacements, deux facons de valider. On garde le formulaire : l'etat
 * vit dans l'URL, la page reste un Server Component, et filtrer remet la
 * pagination a zero puisque `page` n'est pas un champ du formulaire.
 * `AutoFilterForm` l'applique tout seul — une liste au changement, la
 * recherche apres la frappe — la ou il fallait valider avec Entree.
 *
 * ⚠️ LA GRILLE NE PASSE PLUS EN COLONNES A `md`, ET C'EST MESURE. `md` (768px)
 * est **aussi** le point ou le rail de 16rem devient `fixed` : le contenu tombe
 * de 608 a 480 px au moment precis ou la mise en page se decoupe en 12
 * colonnes. Les media queries lisent le **viewport**, pas le conteneur, donc
 * `md:col-span-3` valait ~110 px — et le `<select>` qu'il porte tombait a
 * **21 px**, mesure au navigateur. Deux colonnes jusqu'a `xl`, davantage
 * ensuite. (`grid-cols-*` de Tailwind vaut `minmax(0,1fr)` : les pistes
 * retrecissent sous leur contenu au lieu de deborder, donc le symptome est un
 * controle ecrase et non une barre de defilement — c'est pourquoi il ne se
 * voit pas en cherchant un debordement.)
 */
export async function ModerationFilters({
  vue,
  params,
  available,
}: {
  vue: Vue;
  params: Record<string, string | undefined>;
  available: boolean;
}) {
  const i18n = await getAdminI18n();

  // Les etats de moderation de 0089 ne sont proposes que si la migration est
  // posee — sinon le filtre existerait sans pouvoir rien ramener.
  const etat = {
    name: "etat",
    label: i18n.t("Etat"),
    all: i18n.t("Tous les etats"),
    options: [
      { value: "en_ligne", label: i18n.t("En ligne") },
      ...(available
        ? [
            { value: "attente", label: i18n.t("En attente de validation") },
            // Ce qui a ete valide se retrouvait par aucun filtre : « En ligne »
            // dit `is_hidden = false`, pas « approuvee par quelqu'un ».
            { value: "validee", label: i18n.t("Validee") },
            { value: "refuse_validation", label: i18n.t("Refusee") },
          ]
        : []),
      { value: "masque", label: i18n.t("Masquee") },
      { value: "supprime", label: i18n.t("Supprimee") },
    ],
  };

  const search =
    vue === "signalements"
      ? i18n.t("Rechercher par motif…")
      : vue === "publications"
        ? i18n.t("Rechercher dans le texte…")
        : i18n.t("Rechercher dans les commentaires…");

  const filters =
    vue === "signalements"
      ? [
          {
            name: "statut",
            label: i18n.t("Statut"),
            all: i18n.t("Tous les statuts"),
            options: i18n.labels.options(REPORT_STATUS),
          },
          {
            name: "cible",
            label: i18n.t("Cible"),
            all: i18n.t("Toutes cibles"),
            options: i18n.labels.options(REPORTABLE_TYPE),
          },
        ]
      : [etat];

  // Les medias joueurs n'ont ni recherche ni filtre : un bandeau vide se
  // lirait comme un bandeau casse.
  if (vue === "medias") return null;

  return (
    <section className="rounded-xl border border-border bg-card p-2.5">
      <AutoFilterForm
        className={cn(
          "grid grid-cols-1 items-center gap-2 sm:grid-cols-2",
          filters.length > 1 ? "xl:grid-cols-4" : "xl:grid-cols-3",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-background px-3 py-1.5 sm:col-span-2">
          <FilterSearchIcon icon={<SearchIcon className="size-4" />} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={search}
            aria-label={search}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {/* Effacer d'un clic : `AutoFilterForm` lit la valeur vide de ce
              bouton, qui l'emporte sur le texte du champ. */}
          {params.q ? (
            <button
              type="submit"
              name="q"
              value=""
              title={i18n.t("Effacer la recherche")}
              aria-label={i18n.t("Effacer la recherche")}
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
        {filters.map((filter) => (
          <ModerationFilter
            key={filter.name}
            name={filter.name}
            label={filter.label}
            value={params[filter.name]}
            all={filter.all}
            options={filter.options}
          />
        ))}
      </AutoFilterForm>
    </section>
  );
}

/** Liste de filtre de la maquette : intitule colle au `<select>` natif. */
function ModerationFilter({
  name,
  label: name_,
  value,
  all,
  options: choices,
}: {
  name: string;
  label: string;
  value?: string;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    // `min-w-0` des deux cotes : sans lui, le libelle `whitespace-nowrap` et la
    // largeur intrinseque du `<select>` (celle de sa plus longue option) se
    // disputent une piste qui, elle, accepte de retrecir — et c'est le
    // `<select>` qui perd.
    <label className="flex min-w-0 items-center gap-2 rounded-lg bg-background px-3 py-1.5">
      <span className="micro-label shrink-0 whitespace-nowrap text-muted-foreground">
        {name_} :
      </span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-full min-w-0 cursor-pointer bg-transparent text-xs font-semibold outline-none"
      >
        <option value="">{all}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

