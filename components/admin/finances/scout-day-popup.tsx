import Link from "next/link";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { DefinitionList } from "@/components/admin/definition-list";
import { DetailDialog } from "@/components/admin/detail-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { buttonVariants } from "@/components/ui/button";
import { getAdminI18n } from "@/lib/i18n/admin";
import { REGISTRATION_STATUS, SCOUT_DAY_STATUS } from "@/lib/labels";
import { displayName, type ProfileSummary } from "@/lib/queries/profiles";
import type { ScoutDayDetail } from "@/lib/queries/scout-day-payments";
import { cn } from "@/lib/utils";

/**
 * « De quel Scout Day parle-t-on ? » — la question que cet ecran posait sans y
 * repondre.
 *
 * ⚠️⚠️ CE QUE CE COMPOSANT CORRIGE. L'evenement n'etait qu'un lien dans une
 * cellule marquee `max-lg:hidden` : sur telephone — la facon dont ce
 * back-office est reellement consulte — l'administrateur voyait « Adam
 * Mansouri · 25,000 TND · Marquer comme paye » et aucun moyen de savoir ce
 * qu'il encaissait. Et sur grand ecran, le titre seul ne tranche pas entre
 * deux editions d'un meme evenement. Le geste porte sur de l'argent : il ne
 * peut pas dependre d'une colonne masquee.
 *
 * Le declencheur est donc un **bouton portant le nom de l'evenement**, visible
 * a toutes les largeurs, qui ouvre la fiche courte — date, horaire, lieu,
 * tarif, capacite, organisateur — plus, quand l'appelant la fournit, la
 * situation de l'inscription et le geste lui-meme.
 *
 * ⚠️ RIEN N'EST REQUETE ICI. `DetailDialog` rend ses enfants **cote serveur**
 * (c'est un slot, pas une fonction), donc la fiche arrive deja rendue : une
 * ligne de tableau ne declenche pas une requete de plus, et l'organisateur
 * est passe en prop par l'appelant, qui groupe deja ses lectures de profils.
 *
 * ⚠️ Le popup ne duplique pas la fiche de l'evenement — il y mene. Tout ce
 * qui depasse l'identification (inscriptions, evaluations, validation) reste
 * sur `/admin/scout-days/{id}`, et le dernier bouton du popup y conduit.
 */
export async function ScoutDayPopup({
  event,
  organizer,
  registration,
  action,
  className,
}: {
  event: ScoutDayDetail;
  /** L'organisateur, deja charge par l'appelant. */
  organizer?: ProfileSummary;
  /** La situation de l'inscription, quand le popup en accompagne une. */
  registration?: { status: string | null; registeredAt: string | null };
  /** Le geste a proposer dans le pied du popup (un `ActionButton` lie). */
  action?: React.ReactNode;
  className?: string;
}) {
  const i18n = await getAdminI18n();

  const title = event.title?.trim() || i18n.t("Evenement sans titre");
  const status = i18n.labels.entry(SCOUT_DAY_STATUS, event.status);
  // `start_time` est un `time` Postgres : « 09:00:00 ». La convention du depot
  // est de n'en garder que les heures et les minutes.
  const hours = [event.startTime, event.endTime]
    .filter(Boolean)
    .map((value) => String(value).slice(0, 5))
    .join(" – ");

  return (
    <DetailDialog
      // ⚠️ TROIS RETOURS CLIENT ONT FACONNE CE DECLENCHEUR, dans cet ordre :
      //
      //  1. « test doit etre juste sous EVENEMENT » — toutes les autres
      //     colonnes alignent leur valeur sur leur en-tete, celle-ci ne le
      //     faisait pas ;
      //  2. « on doit comprendre que c'est un bouton » — la version sans
      //     bordure se lisait comme du texte ;
      //  3. « mets-le au centre sous l'en-tete » — ce qui **tranche** le point
      //     1 : la colonne entiere est centree, en-tete compris, donc le
      //     libelle tombe sous l'en-tete sans qu'on ait rien a compenser.
      //
      // C'est pourquoi la marge negative qui servait au point 1 a disparu :
      // elle annulait la marge interne du bouton pour faire coincider son
      // TEXTE avec un en-tete aligne a gauche. Centrer les deux repond a la
      // meme question plus simplement — l'alignement est desormais pose par la
      // cellule (`text-center`), jamais par ce composant, qui ne sait pas dans
      // quelle colonne il sera rendu.
      //
      // L'icone reste **apres** le libelle : c'est le nom qu'on lit en
      // parcourant la colonne, et l'embleme n'a pas a le preceder.
      icon={null}
      label={
        <>
          {/* La troncature a besoin d'une largeur explicite : le declencheur
              est un `inline-flex`, ou `truncate` pose sur le conteneur ne
              rogne pas ses enfants. `title` rend le nom complet au survol. */}
          <span className="block max-w-36 truncate sm:max-w-48" title={title}>
            {title}
          </span>
          <CalendarDaysIcon className="text-muted-foreground" />
        </>
      }
      className={cn("max-w-full font-medium", className)}
      title={title}
      description={i18n.t("La fiche courte de l'evenement : de quoi reconnaitre ce qui est encaisse, sans quitter le releve.")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <StatusPill tone={event.isPaid ? "brand" : "neutral"}>
          {event.isPaid
            ? i18n.format.formatAmount(event.priceAmount, event.priceCurrency ?? "TND")
            : i18n.t("Gratuit")}
        </StatusPill>
        {registration ? (
          <StatusPill tone={i18n.labels.entry(REGISTRATION_STATUS, registration.status).tone}>
            {i18n.labels.label(REGISTRATION_STATUS, registration.status)}
          </StatusPill>
        ) : null}
      </div>

      <DefinitionList
        items={[
          {
            icon: CalendarDaysIcon,
            label: i18n.t("Date"),
            value: i18n.format.formatDate(event.eventDate),
          },
          {
            icon: ClockIcon,
            label: i18n.t("Horaires"),
            value: hours || "—",
          },
          {
            icon: MapPinIcon,
            label: i18n.t("Lieu"),
            value: event.location?.trim() ? (
              <span className="flex flex-col">
                <span>{event.location}</span>
                {event.locationAddress?.trim() ? (
                  <span className="text-xs text-muted-foreground">{event.locationAddress}</span>
                ) : null}
              </span>
            ) : (
              "—"
            ),
          },
          {
            icon: UsersIcon,
            label: i18n.t("Capacite"),
            value: event.capacity ? i18n.format.formatNumber(event.capacity) : "—",
          },
          {
            icon: TicketIcon,
            label: i18n.t("Tarif"),
            value: event.isPaid
              ? i18n.format.formatAmount(event.priceAmount, event.priceCurrency ?? "TND")
              : i18n.t("Gratuit"),
          },
          // ⚠️ L'organisateur n'est affiche QUE s'il a ete charge. La ligne
          // des paiements ne le charge pas : ses identites sont lues en meme
          // temps que l'evenement, donc l'organisateur demanderait une vague
          // de plus sur chaque affichage de l'ecran — et ce qu'un ecran coute
          // se compte en allers-retours. Un champ vide vaut moins qu'un champ
          // absent : il laisse croire a un evenement sans organisateur.
          ...(organizer
            ? [
                {
                  icon: UserRoundIcon,
                  label: i18n.t("Organisateur"),
                  value: (
                    <UserCell
                      name={displayName(organizer, undefined, i18n.locale)}
                      secondary={organizer.email}
                      avatarUrl={organizer.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${organizer.id}`)}
                    />
                  ),
                },
              ]
            : []),
          ...(registration
            ? [
                {
                  icon: ClockIcon,
                  label: i18n.t("Inscrit le"),
                  value: i18n.format.formatDateTime(registration.registeredAt),
                },
              ]
            : []),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
        <Link
          href={i18n.path(`/admin/scout-days/${event.id}`)}
          className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
        >
          {i18n.t("Ouvrir la fiche de l'evenement")}
          <ArrowUpRightIcon />
        </Link>
        {action}
      </div>
    </DetailDialog>
  );
}
