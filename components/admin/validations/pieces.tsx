import Link from "next/link";
import {
  BadgeCheckIcon,
  ClockIcon,
  FilterIcon,
  IdCardIcon,
  SearchIcon,
  ShieldAlertIcon,
  SmartphoneIcon,
  TimerIcon,
  XCircleIcon,
} from "lucide-react";

import { MetricStrip } from "@/components/admin/metric-strip";
import { NoteCards } from "@/components/admin/note-cards";
import { getAdminI18n } from "@/lib/i18n/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Les pieces communes aux quatre ecrans de validation.
 *
 * Joueurs, professionnels, justificatifs et pieces d'identite vivaient dans
 * une seule page derriere `?vue=` ; ce sont maintenant quatre routes, comme
 * pour la moderation. Ce qui les entoure — les quatre mesures, la barre de
 * recherche, les notes de bas d'ecran — est commun, et le copier quatre fois
 * serait quatre endroits a corriger.
 */

/** Les quatre files, qui sont maintenant quatre routes. */
export const VALIDATION_VUES = ["joueurs", "professionnels", "justificatifs", "identite"] as const;
export type ValidationVue = (typeof VALIDATION_VUES)[number];

/** Le chemin d'une file, sans le prefixe de langue. */
export const validationPath = (vue: ValidationVue) => `/admin/validations/${vue}` as const;

/**
 * Les quatre mesures d'en-tete. Elles portent sur **l'ensemble** des files —
 * « les quatre files reunies », le delai moyen d'examen, le taux
 * d'approbation — donc elles restent identiques d'un ecran a l'autre et sont
 * calculees au meme endroit.
 */
export async function ValidationMetrics() {
  const i18n = await getAdminI18n();
  const supabase = await createClient();

  const window30d = new Date();
  window30d.setDate(window30d.getDate() - 30);
  const since30d = window30d.toISOString();
  const [playersCount, prosCount, docsCount, kycCount, approved30d, refused30d] =
    await Promise.all([
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente_validation"),
    supabase
      .from("professional_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente_validation"),
    supabase
      .from("professional_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
    supabase
      .from("identity_verifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
    // Decisions des 30 derniers jours : `status_updated_at` est ecrit par le
    // trigger de changement de statut, c'est donc la date de la decision, pas
    // celle du dossier.
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "valide")
      .gte("status_updated_at", since30d),
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "refuse")
      .gte("status_updated_at", since30d),
  ]);

  // Delai moyen entre le depot d'une piece d'identite et sa revue, sur les 200
  // dernieres revues. Calcule a partir des deux horodatages reels ; « — » tant
  // qu'aucune piece n'a ete revue, plutot qu'un chiffre invente.
  const { data: reviewed } = await supabase
    .from("identity_verifications")
    .select("created_at, reviewed_at")
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(200);
  const delays = (reviewed ?? [])
    .map((row) => new Date(row.reviewed_at!).getTime() - new Date(row.created_at).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  const reviewDelay = delays.length
    ? i18n.format.formatDuration(delays.reduce((acc, value) => acc + value, 0) / delays.length)
    : null;

  const decisions30d = (approved30d.count ?? 0) + (refused30d.count ?? 0);
  const pending =
    (playersCount.count ?? 0) +
    (prosCount.count ?? 0) +
    (docsCount.count ?? 0) +
    (kycCount.count ?? 0);

  return (
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricStrip
          label={i18n.t("Delai moyen d'examen")}
          value={reviewDelay ?? "—"}
          hint={i18n.t("Entre le depot d'une piece et sa revue")}
          icon={TimerIcon}
        />
        <MetricStrip
          label={i18n.t("Dossiers en attente")}
          value={pending}
          hint={i18n.t("Les quatre files reunies")}
          icon={ClockIcon}
          tone="brand"
        />
        <MetricStrip
          label={i18n.t("Refuses (30 j)")}
          value={refused30d.count ?? 0}
          hint={i18n.t("Profils joueurs renvoyes avec un motif")}
          icon={ShieldAlertIcon}
          tone="danger"
        />
        <MetricStrip
          label={i18n.t("Taux d'approbation")}
          value={
            decisions30d > 0
              ? `${Math.round(((approved30d.count ?? 0) / decisions30d) * 100)} %`
              : "—"
          }
          hint={i18n.t("Sur {0} decision(s) des 30 derniers jours", { "0": decisions30d })}
          icon={BadgeCheckIcon}
          tone="info"
        />
      </section>
  );
}

/**
 * La barre de recherche, UNE pour les quatre ecrans.
 *
 * Formulaire GET, comme partout dans ce back-office : l'etat vit dans l'URL,
 * la page reste un Server Component, et soumettre remet la pagination a zero
 * puisque `page` n'est pas un champ du formulaire. Plus de champ cache `vue` :
 * chaque file est une route, le formulaire reposte sur son propre chemin.
 */
export async function ValidationFilter({
  search,
  path,
}: {
  search?: string;
  /** Le chemin de la file courante, deja prefixe de la langue. */
  path: string;
}) {
  const i18n = await getAdminI18n();

  return (
    <form
      method="get"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-2.5"
    >
      <div className="flex min-w-72 flex-1 items-center gap-2 rounded-lg bg-background px-3 py-1.5">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          name="q"
          defaultValue={search ?? ""}
          placeholder={i18n.t("Filtrer par nom, club ou nationalite…")}
          className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        {search ? (
          <Link
            href={path}
            aria-label={i18n.t("Effacer le filtre")}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircleIcon className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold hover:bg-accent/70"
        >
          <FilterIcon className="size-3.5" />
          {i18n.t("Appliquer")}</button>
        <span className="micro-label text-muted-foreground">
          {i18n.t("Trie par : plus ancien d'abord")}</span>
      </div>
    </form>
  );
}

/** Les trois notes qui ferment chacun des quatre ecrans. */
export async function ValidationNotes() {
  const i18n = await getAdminI18n();
  return (
    <NoteCards
        notes={[
          {
            icon: SmartphoneIcon,
            title: i18n.t("Ce que la validation debloque"),
            body: i18n.t("L'application mobile decide de laisser entrer un utilisateur sur le statut de son profil — joueur ou professionnel — et sur rien d'autre. Tant que ce profil n'est pas valide, elle le renvoie vers l'ecran d'attente, quel que soit l'etat de ses pieces."),
          },
          {
            icon: IdCardIcon,
            title: i18n.t("Piece d'identite ≠ compte valide"),
            body: i18n.t("La revue d'une piece d'identite est un controle distinct de la validation du compte. Accepter la piece ne donne pas l'acces : les deux gestes sont volontairement separes, et refuser une piece demande un motif, transmis a l'interesse."),
          },
          {
            icon: BadgeCheckIcon,
            title: i18n.t("Un refus reste reversible"),
            body: i18n.t("Un dossier refuse retourne a son auteur avec le motif ecrit ici. Il repasse dans cette file des qu'il est corrige : rien n'est efface, et l'historique du statut reste lisible sur la fiche du compte."),
          },
        ]}
      />
  );
}

export async function QueueError({ message }: { message: string }) {
  const i18n = await getAdminI18n();

  return (
    <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
      {i18n.t("Lecture impossible :")} {message}
    </p>
  );
}
