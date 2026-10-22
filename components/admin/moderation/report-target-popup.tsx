import Link from "next/link";
import {
  ArrowUpRightIcon,
  BanIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  MessagesSquareIcon,
  TriangleAlertIcon,
  VideoIcon,
} from "lucide-react";

import { DetailDialog } from "@/components/admin/detail-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { buttonVariants } from "@/components/ui/button";
import { getAdminI18n } from "@/lib/i18n/admin";
import { REPORTABLE_TYPE } from "@/lib/labels";
import { displayName, type ProfileSummary } from "@/lib/queries/profiles";
import type { ReportTarget } from "@/lib/queries/moderation";
import { cn } from "@/lib/utils";

/**
 * « Qu'est-ce qui a ete signale, au juste ? » — la question que la file posait
 * sans y repondre.
 *
 * ⚠️⚠️ CE QUE CE COMPOSANT CORRIGE. La colonne « Contenu signale » rendait un
 * extrait `max-w-64 truncate` : une phrase coupee au milieu, sans son media,
 * sans l'etat deja applique au contenu, sans la date. Pour en voir davantage
 * il fallait ouvrir le dossier — une navigation complete, donc un retour en
 * arriere et la perte de la position dans deux cents lignes, pour simplement
 * reconnaitre une publication. `fetchReportTargets()` resout pourtant **deja**
 * 400 caracteres d'extrait, l'URL du media, son type, l'auteur, la date et les
 * drapeaux de moderation, pour chaque ligne de la page : tout cela etait lu,
 * paye, puis jete a l'affichage.
 *
 * Meme geste que le popup des paiements et des abonnements : un declencheur
 * qui porte le nom de sa cible, et une fiche courte qui tient dans le flux de
 * travail.
 *
 * ⚠️ RIEN N'EST REQUETE ICI. `DetailDialog` rend ses enfants **cote serveur**
 * (c'est un slot, pas une fonction) : la fiche arrive deja rendue et une ligne
 * de tableau ne declenche aucune requete supplementaire. C'est la condition
 * qui avait fait renoncer a la popup de publication sur cet ecran — elle
 * chargeait un fil de discussion par ligne. Celle-ci ne lit rien.
 *
 * ⚠️⚠️ **AUCUN GESTE DE DECISION N'Y FIGURE, ET C'EST DELIBERE.** La ligne a
 * ete volontairement desarmee (voir le commentaire de la derniere colonne de
 * `signalements/page.tsx`) : proposer un retrait exige un motif ecrit et les
 * pieces sous les yeux, donc cela se fait dans le dossier. Cette fiche sert a
 * **reconnaitre**, pas a trancher — elle y mene, par son pied.
 */
export async function ReportTargetPopup({
  targetType,
  targetId,
  summary,
  content,
  author,
  account,
  reason,
  reporterName,
  reportCount,
  blocksReceived,
  fromMessaging,
  quarantined,
  dossierHref,
  className,
}: {
  targetType: string;
  targetId: string;
  /** Le libelle du declencheur : deja calcule par l'appelant, qui l'affiche aussi. */
  summary: string;
  /** La cible resolue par `fetchReportTargets()`. Absente = contenu disparu. */
  content?: ReportTarget;
  /** L'auteur du contenu, deja charge par l'appelant. */
  author?: ProfileSummary;
  /** Le compte vise, quand le signalement porte sur un compte et non un contenu. */
  account?: ProfileSummary;
  /** Le motif ecrit par le signaleur, en entier. */
  reason?: string | null;
  /** Qui l'a ecrit. */
  reporterName?: string;
  /** Combien de signalements visent cette meme cible. */
  reportCount: number;
  /** Combien de comptes ont bloque le compte vise. */
  blocksReceived?: number;
  /** Le signalement vient de la messagerie privee. */
  fromMessaging?: boolean;
  quarantined?: boolean;
  dossierHref: string;
  className?: string;
}) {
  const i18n = await getAdminI18n();
  const isAccount = Boolean(account) && !content;
  const typeLabel = i18n.labels.label(REPORTABLE_TYPE, targetType);
  // L'auteur du contenu, ou a defaut le compte vise — un signalement de compte
  // n'a pas d'auteur distinct de sa cible.
  const person = author ?? account;

  return (
    <DetailDialog
      // L'icone apres le libelle, comme le popup des paiements : c'est
      // l'extrait qu'on lit en parcourant la colonne.
      icon={null}
      label={
        <>
          {/* La troncature a besoin d'une largeur explicite : le declencheur
              est un `inline-flex`, ou `truncate` pose sur le conteneur ne
              rogne pas ses enfants. `title` rend le texte complet au survol. */}
          <span className="block max-w-48 truncate text-left sm:max-w-64" title={summary}>
            {summary}
          </span>
          <EyeIcon className="shrink-0 text-muted-foreground" />
        </>
      }
      className={cn("max-w-full font-medium", className)}
      // ⚠️ LE TITRE EST LE TYPE, PAS L'EXTRAIT. La premiere version reprenait
      // le texte du declencheur, qui etait ensuite re-affiche en entier juste
      // dessous : le meme texte deux fois, dont une version tronquee. Le titre
      // repond « qu'est-ce que c'est », le corps montre « ce que c'est ».
      title={typeLabel}
      description={i18n.t("Ce qui a ete signale, sans quitter la file. Les gestes de decision restent dans le dossier.")}
    >
      {/* --- 1. Les signaux, en une rangee. Ce qu'on ne peut pas lire dans le
              contenu : son etat de moderation, combien de fois il a ete
              signale, d'ou vient le signalement. --- */}
      <div className="flex flex-wrap items-center gap-2">
        {(content?.state ?? []).map((flag) => (
          <StatusPill key={flag} tone="danger">
            {flag}
          </StatusPill>
        ))}
        {quarantined ? (
          <StatusPill tone="warning">
            <EyeOffIcon />
            {i18n.t("En quarantaine")}
          </StatusPill>
        ) : null}
        {reportCount > 1 ? (
          <StatusPill tone="warning">
            <FlagIcon />
            {reportCount}  {i18n.t("signalements")}
          </StatusPill>
        ) : null}
        {fromMessaging ? (
          <StatusPill tone="info">
            <MessagesSquareIcon />
            {i18n.t("Messagerie")}
          </StatusPill>
        ) : null}
        {blocksReceived ? (
          <StatusPill tone="warning">
            <BanIcon />
            {blocksReceived}  {i18n.t("blocage")}{blocksReceived > 1 ? "s" : ""}
          </StatusPill>
        ) : null}
        {/* La reference, en bout de rangee et en chiffres fixes : c'est ce
            qu'on recopie pour en parler, et c'est ainsi que le dossier la
            presente. `ms-auto` la pousse a droite quand la place le permet. */}
        <span className="ms-auto font-mono text-[0.6875rem] text-muted-foreground">
          {i18n.t("Reference")} {targetId.slice(0, 8)}
        </span>
      </div>

      {/* --- 2. La piece, dans UN seul cadre : media en haut, texte ensuite,
              bandeau d'auteur en pied. C'est exactement la mise en page du
              dossier vers lequel ce popup mene — reconnaitre ici, c'est deja
              savoir ou regarder la-bas. --- */}
      <section className="overflow-hidden rounded-xl border border-border bg-background">
        {content?.mediaUrl && content.mediaType === "photo" ? (
          <Link
            href={content.mediaUrl}
            target="_blank"
            title={i18n.t("Ouvrir l'image en taille reelle")}
            className="block bg-secondary/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.mediaUrl}
              alt={i18n.t("Media de la publication signalee")}
              className="mx-auto max-h-72 w-full object-contain"
            />
          </Link>
        ) : null}

        {content?.mediaUrl && content.mediaType === "video" ? (
          <video
            src={content.mediaUrl}
            controls
            preload="metadata"
            className="max-h-72 w-full bg-black"
          />
        ) : null}

        <div className="space-y-3 p-4">
          {/* L'extrait COMPLET tel que la requete le ramene (400 caracteres),
              et non la troncature de la colonne : c'est tout l'interet de
              cette fiche. `whitespace-pre-line` garde les retours a la ligne
              de l'auteur ; au-dela d'une certaine longueur le texte defile
              dans sa propre boite plutot que d'etirer la modale. */}
          {content?.excerpt ? (
            <p className="max-h-56 overflow-y-auto text-sm leading-relaxed whitespace-pre-line">
              {content.excerpt}
            </p>
          ) : null}

          {/* Un contenu sans texte ni media n'est pas « vide » : son contenu
              est ailleurs (une image, un message chiffre), et `placeholder` le
              dit en toutes lettres. */}
          {content && !content.excerpt && !content.mediaUrl ? (
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              {content.placeholder}
            </p>
          ) : null}

          {content?.mediaUrl && content.mediaType === "lien" ? (
            <Link
              href={content.mediaUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <VideoIcon className="size-3.5" />
              {i18n.t("Ouvrir la video")}
            </Link>
          ) : null}

          {isAccount ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {i18n.t("Le signalement vise le compte lui-meme, pas une publication precise : la mesure disponible porte donc sur le compte.")}
            </p>
          ) : null}

          {/* Cible introuvable : on le dit, on n'invente pas une fiche vide. */}
          {!content && !isAccount ? (
            <p className="text-sm text-muted-foreground">{i18n.t("Contenu indisponible")}</p>
          ) : null}

          {/* Bandeau d'auteur : qui a publie, quand, et la fiche de la cible
              quand elle en a une. Il remplace la liste de definitions de la
              premiere version, qui repetait le type deja pose en titre. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
            {person ? (
              <UserCell
                name={displayName(person, undefined, i18n.locale)}
                secondary={person.email}
                avatarUrl={person.avatar_url}
                href={i18n.path(`/admin/utilisateurs/${content?.authorId ?? person.id}`)}
              />
            ) : (
              <span className="text-xs text-muted-foreground">{i18n.t("Auteur introuvable")}</span>
            )}
            <span className="flex-1" />
            {content?.createdAt ? (
              <span className="text-xs text-muted-foreground">
                {i18n.format.formatDateTime(content.createdAt)}
              </span>
            ) : null}
            {content?.href ? (
              <Link
                href={content.href}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                {i18n.t("Fiche")}
                <ArrowUpRightIcon className="size-3" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* --- 3. Ce qu'on lui reproche. Le motif est la SEULE piece qu'un
              signalement apporte de lui-meme, et la colonne voisine le coupe a
              la largeur disponible. Le voir en entier a cote du contenu, c'est
              la question complete : qu'est-ce que c'est, et que lui
              reproche-t-on. --- */}
      {reason?.trim() ? (
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <p className="micro-label mb-1.5 text-muted-foreground">
            {i18n.t("Motif du signalement")}
          </p>
          <p className="max-h-32 overflow-y-auto text-sm leading-relaxed whitespace-pre-line">
            {reason}
          </p>
          {reporterName ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {i18n.t("par")} {reporterName}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --- 4. La sortie : le dossier, ou tout se decide. --- */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
        <Link href={dossierHref} className={cn(buttonVariants({ variant: "default", size: "xs" }))}>
          <EyeIcon />
          {i18n.t("Ouvrir le dossier")}
        </Link>
      </div>
    </DetailDialog>
  );
}
