"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MaximizeIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { StatusPill } from "@/components/admin/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { WHY_ICON, WHY_TONE, type WhyLine } from "@/lib/moderation-why";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Une ligne du fil de discussion affiché sous la publication.
 *
 * ⚠️ Résolue par la page (noms d'auteurs compris) et passée telle quelle : ce
 * composant est **client**, il ne peut ni requêter ni importer `UserCell`, qui
 * atteint `server-only`. Même contrainte que pour les Server Actions, déjà
 * payée deux fois sur ce fichier.
 */
export type ThreadEntry = {
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
 * Le commentaire, quand c'est LUI qu'on modere.
 *
 * ⚠️ La popup etait ecrite pour une publication seule : ouverte depuis l'ecran
 * des commentaires, elle montrait le fil et portait les gestes **de la
 * publication**. Moderer le commentaire restait donc a faire sur la ligne,
 * c'est-a-dire sur un texte tronque et sans son contexte — exactement ce que
 * la popup existe pour eviter. Quand `comment` est fourni, le sujet de la
 * popup est le commentaire : son texte, ses pastilles, ses gestes ; la
 * publication devient le contexte qui l'eclaire.
 */
export type PreviewComment = {
  id: string;
  content: string;
  createdAtLabel?: string;
  isHidden: boolean;
  isDeleted: boolean;
  moderationStatus?: "en_attente" | "approuve" | "refuse";
  moderationReason?: string | null;
  why?: WhyLine[];
  /** « <auteur> — <debut du texte> » du commentaire auquel celui-ci repond. */
  replyTo?: string | null;
  author: { id: string; name: string; email?: string | null; avatarUrl?: string | null };
};

export type PreviewPost = {
  id: string;
  content: string | null;
  mediaType: "aucun" | "photo" | "video" | "lien";
  mediaUrl: string | null;
  createdAt: string;
  isHidden: boolean;
  isDeleted: boolean;
  moderationStatus?: "en_attente" | "approuve" | "refuse";
  moderationReason?: string | null;
  /** Date deja mise en forme par la page : voir `createdAt`. */
  createdAtLabel?: string;
  /**
   * Ce qui met la publication en cause — signalements, refus motive, trace de
   * validation —, resolu par la page (`whyLines()`). Il etait rendu sur la
   * ligne de liste **et nulle part dans cette popup**, c'est-a-dire absent de
   * l'ecran ou la decision se prend.
   */
  why?: WhyLine[];
  author: { id: string; name: string; email?: string | null; avatarUrl?: string | null };
};

/**
 * ⚠️ Meme precaution que `ReasonDialog` : Base UI compose le declencheur via
 * `render`, et la fusion de `data-slot="button"` avec
 * `data-slot="dialog-trigger"` ne tranche pas pareil au rendu serveur et au
 * rendu client — une erreur d'hydratation sur chaque dialogue rendu dans une
 * page serveur. On impose donc la valeur du primitif.
 */
function asTrigger(trigger: React.ReactNode): React.ReactElement {
  return React.isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
        "data-slot": "dialog-trigger",
      })
    : (trigger as unknown as React.ReactElement);
}

/**
 * Lire une publication en entier, puis trancher — sans quitter la liste.
 *
 * POURQUOI UNE POPUP. La file d'attente affichait le texte integral en ligne,
 * ce qui allonge la page a proportion de ce qui attend et noie le geste. La
 * popup rend la publication **telle que l'auteur l'a deposee** (texte complet,
 * media a sa taille) et porte tous les gestes au meme endroit : valider,
 * refuser avec motif, masquer, supprimer.
 *
 * ⚠️ LE REFUS EST UNE ETAPE DE CETTE POPUP, PAS UNE SECONDE POPUP. Empiler
 * deux `Dialog` marche sur un poste de travail et se comporte mal des que le
 * clavier ou un lecteur d'ecran s'en mele — le second vole le focus au
 * premier, qui reste monte dessous. Le motif s'ecrit donc ici, en place.
 *
 * ⚠️ « Supprimer » ecrit `is_deleted`, ce n'est pas un DELETE. Le schema ne
 * prevoit **aucune** policy DELETE d'administration sur `posts` : un contenu
 * retire reste lisible par l'administration, ce qui est necessaire pour
 * instruire un signalement. Le libelle dit « Supprimer » parce que c'est ce
 * que l'utilisateur constate ; la ligne, elle, reste.
 */
export function PostPreviewDialog({
  post,
  comment,
  canValidate,
  trigger,
  statusLabel,
  thread,
  focusCommentId,
  onApprove,
  onRefuse,
  onToggleHidden,
  onToggleDeleted,
}: {
  /**
   * La publication. **Facultative** quand un commentaire est le sujet : elle
   * peut etre introuvable (supprimee, filtree par la RLS), et le commentaire
   * doit rester moderable — un dossier incomplet n'est pas un dossier absent.
   */
  post?: PreviewPost;
  /**
   * Le commentaire, quand c'est lui qu'on modere. Les quatre actions
   * ci-dessous portent alors sur **lui**, pas sur la publication : c'est
   * l'appelant qui les lie, comme partout ailleurs.
   */
  comment?: PreviewComment;
  /** `content.validate` — super administrateur. Cache valider / refuser. */
  canValidate: boolean;
  trigger: React.ReactNode;
  /** Libelle et ton de l'etat de validation, resolus par la page (labels FR/EN). */
  statusLabel?: { label: string; tone: "warning" | "success" | "danger" };
  /**
   * Le fil de discussion de la publication, racine puis réponses dans
   * l'ordre. Absent quand il n'y a rien à montrer, ou quand la migration 0093
   * n'est pas posée.
   */
  thread?: ThreadEntry[];
  /** L'id du commentaire qu'on est en train de modérer, mis en évidence. */
  focusCommentId?: string | null;
  /**
   * ⚠️ LES ACTIONS ARRIVENT **LIEES, PAR ACCESSOIRE**, jamais importees ici.
   *
   * `lib/actions/*.ts` importe `getRequestAdminI18n`, donc `next/headers`,
   * `next/root-params` et `server-only`. Les importer depuis ce composant
   * client tire tout ce graphe dans le bundle navigateur et casse la
   * compilation (« 'server-only' cannot be imported from a Client Component
   * module »). Le test `npm run test:i18n` garde cette regle — c'est lui qui a
   * attrape le defaut. Meme convention que `ActionButton`, dont l'appelant
   * ecrit `action={maction.bind(null, id)}`.
   */
  onApprove: () => Promise<ActionResult>;
  onRefuse: (reason: string) => Promise<ActionResult>;
  onToggleHidden: () => Promise<ActionResult>;
  onToggleDeleted: () => Promise<ActionResult>;
}) {
  const { dict, fill } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [refusing, setRefusing] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const t = dict.postPreview;
  const motif = reason.trim();
  /**
   * LE SUJET : ce sur quoi portent l'entete, les pastilles et les gestes.
   * Un commentaire s'il y en a un, la publication sinon. Tout le reste de ce
   * composant lit `subject` — ecrire deux fois la mecanique de decision
   * (refus en place, etats de chargement, fermeture) la ferait diverger.
   */
  const subject = comment ?? post;

  async function run(key: string, action: () => Promise<ActionResult>, close = true) {
    setPending(key);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        if (close) setOpen(false);
        setRefusing(false);
        setReason("");
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(dict.common.actionFailed);
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;
  const spin = (key: string) =>
    pending === key ? <Loader2Icon className="animate-spin" /> : null;

  // Ni publication ni commentaire : il n'y a rien a ouvrir, et un declencheur
  // qui ouvre une popup vide fait douter de tout l'ecran.
  if (!subject) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Rouvrir ne doit pas retrouver un motif a demi ecrit pour une autre
        // decision : l'etat de refus meurt avec la popup.
        if (!next) {
          setRefusing(false);
          setReason("");
        }
      }}
    >
      <DialogTrigger render={asTrigger(trigger)} />
      {/* ⚠️ UNE SEULE ZONE DEFILANTE, et c'est le changement de fond de cette
          popup. Elle defilait en entier *et* contenait deux boites a defilement
          interne (le texte, le fil) : trois ascenseurs imbriques, et des gestes
          qui sortaient de l'ecran des que la publication etait longue. L'entete
          (qui l'a ecrite) et le pied (ce qu'on peut en faire) sont desormais
          fixes, le corps seul defile. `grid-rows-[auto_minmax(0,1fr)_auto]`
          + `min-h-0` sur le corps : sans l'un ou l'autre, une piste de grille
          ne descend pas sous la taille de son contenu et rien ne defilerait du
          tout. Et `grid-cols-1` — soit `minmax(0,1fr)` — parce qu'une colonne
          `auto` ne descend pas non plus sous la largeur minimale de son
          contenu : MESURE, la popup debordait de 3 px a 375 px, assez pour
          qu'une barre horizontale apparaisse dans une fenetre modale. */}
      <DialogContent className="max-h-[90svh] grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="gap-3 border-b border-border/70 px-5 py-4 pe-14 sm:px-6">
          <div>
            <DialogTitle>{comment ? t.titleComment : t.title}</DialogTitle>
            <DialogDescription>
              {comment ? t.descriptionComment : t.description}
            </DialogDescription>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* ⚠️ PAS de `<UserCell>` ici : c'est un Server Component (il `await`
                le dictionnaire), et l'importer depuis ce fichier client tire
                `lib/i18n/admin.ts` — donc `server-only` — dans le bundle
                navigateur. Le meme test qui a attrape les actions attrape
                celui-la. On redessine donc l'identite a l'identique. */}
            <Link
              href={`/admin/utilisateurs/${subject.author.id}`}
              className="flex min-w-0 items-center gap-3 rounded-md outline-none hover:opacity-80"
            >
              <Avatar className="size-9 shrink-0 rounded-full">
                {subject.author.avatarUrl ? (
                  <AvatarImage src={subject.author.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="rounded-full bg-accent text-[0.625rem] font-semibold tracking-wider">
                  {initials(subject.author.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {subject.author.name}
                </span>
                {subject.author.email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {subject.author.email}
                  </span>
                ) : null}
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {statusLabel ? (
                <StatusPill tone={statusLabel.tone}>{statusLabel.label}</StatusPill>
              ) : null}
              {subject.isHidden ? <StatusPill tone="warning">{t.hidden}</StatusPill> : null}
              {subject.isDeleted ? <StatusPill tone="danger">{t.deleted}</StatusPill> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {/* CE QUI MET LA PUBLICATION EN CAUSE, EN PREMIER. Le motif doit
              arriver avant le contenu : on ne juge pas un texte avant de savoir
              ce qu'on lui reproche. Rien ne s'affiche quand rien ne la vise —
              la plupart des publications n'ont aucune raison d'etre regardees,
              et c'est une reponse, pas un vide. */}
          {subject.why?.length ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-accent/40 px-3 py-2">
              {subject.why.map((line) => {
                const Icon = WHY_ICON[line.kind];
                return (
                  <div
                    key={line.key}
                    className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 text-xs"
                  >
                    <Icon className={cn("mt-0.5 size-3.5 shrink-0", WHY_TONE[line.kind])} />
                    {line.href ? (
                      <Link
                        href={line.href}
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
          ) : null}

          {/* ⚠️ LE CONTEXTE AVANT LE CONTENU, quand le sujet est une reponse :
              « bien joue » sous une annonce et « bien joue » sous une insulte
              ne se moderent pas pareil, et la ligne ne montrait que la reponse
              elle-meme. */}
          {comment?.replyTo ? (
            <p className="border-s-2 border-border ps-3 text-xs text-muted-foreground">
              <span className="font-medium">{t.replyTo}</span> {comment.replyTo}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <p className="micro-label text-muted-foreground">
              {comment ? t.commentLabel : t.content}
            </p>
            {/* Plus de `max-h` ici : le corps de la popup defile, donc le texte
                integral se lit d'un trait au lieu d'etre enferme dans une boite
                de 256 px posee dans une page qui defilait deja. */}
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line">
              {(comment ? comment.content : post?.content)?.trim() ||
                (comment ? comment.content : t.noText)}
            </p>
          </div>

          {/* La publication sous laquelle vit le commentaire : contexte, pas
              sujet — d'ou le libelle qui nomme son auteur, et un cadre plus
              sourd que celui du commentaire. */}
          {comment ? (
            <div className="space-y-1.5">
              <p className="micro-label text-muted-foreground">
                {post ? fill(t.underPost, { nom: post.author.name }) : t.content}
              </p>
              <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {post ? post.content?.trim() || t.noText : t.postMissing}
              </p>
            </div>
          ) : null}

          {post?.mediaUrl && post.mediaType === "photo" ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="micro-label text-muted-foreground">{t.mediaLabel}</p>
                {/* Une photo de moderation se regarde parfois de pres (un
                    visage, un numero, un texte incruste) : la taille de la
                    popup ne doit pas etre la limite. */}
                <Link
                  href={post.mediaUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-brand"
                >
                  <MaximizeIcon className="size-3" />
                  {t.openFull}
                </Link>
              </div>
              <div className="flex justify-center rounded-lg border border-border bg-background p-2">
                {/* ⚠️ `<img>` et non `next/image` : la source est soit une URL
                    signee de Supabase Storage, soit la route `/admin/documents`
                    qui **redirige** vers elle. L'optimiseur de Next voudrait
                    aller chercher l'original lui-meme, sur un hote qui n'est
                    pas declare dans `next.config.ts` — il rendrait 400 sur une
                    image valide. */}
                {/* `max-w-full` est redondant — MESURE : le preflight de
                    Tailwind pose deja `img { max-width: 100% }`. On le garde
                    comme intention locale, pas comme correctif : ne pas croire,
                    sur la foi de cette ligne, qu'un debordement y a ete
                    repare. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.mediaUrl}
                  alt=""
                  className="max-h-[22rem] w-auto max-w-full rounded object-contain"
                />
              </div>
            </div>
          ) : null}

          {post?.mediaUrl && post.mediaType !== "photo" && post.mediaType !== "aucun" ? (
            // Une video ne se joue pas ici : un lecteur qui demarre au milieu
            // d'une file de moderation est une nuisance, et rien ne garantit que
            // le navigateur sache lire ce que Storage renvoie.
            <Link
              href={post.mediaUrl}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
            >
              <ExternalLinkIcon />
              {t.openMedia}
            </Link>
          ) : null}

          {/* Les faits de la publication, groupes : date de depot, nature du
              media, reference. Ils etaient repartis entre la ligne de liste
              (la date) et nulle part (les deux autres) — or c'est ici qu'on
              instruit, et une reference est ce qu'on recopie dans un echange
              avec l'auteur ou avec l'app mobile. */}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-border/70 px-3 py-2.5 sm:grid-cols-3">
            {subject.createdAtLabel ? (
              <div className="min-w-0 space-y-0.5">
                <dt className="micro-label text-muted-foreground">{t.publishedAt}</dt>
                <dd className="truncate text-xs">{subject.createdAtLabel}</dd>
              </div>
            ) : null}
            {/* La nature du media ne dit rien d'un commentaire : 0093 n'en
                attache aucun. La case disparait plutot que d'annoncer
                « Aucun » sur toutes les lignes. */}
            {post && !comment ? (
              <div className="min-w-0 space-y-0.5">
                <dt className="micro-label text-muted-foreground">{t.mediaLabel}</dt>
                <dd className="truncate text-xs">{t.mediaKind[post.mediaType]}</dd>
              </div>
            ) : null}
            <div className="min-w-0 space-y-0.5">
              <dt className="micro-label text-muted-foreground">{t.reference}</dt>
              <dd className="truncate font-mono text-[0.6875rem]" title={subject.id}>
                {subject.id}
              </dd>
            </div>
          </dl>

          {thread && thread.length > 0 ? (
            <div className="space-y-1.5">
              <p className="micro-label text-muted-foreground">
                {t.thread} ({thread.length})
              </p>
              {/* Le fil garde sa propre zone defilante, et c'est la seule qui
                  reste : c'est un bloc secondaire — on decide sur la
                  publication, le fil l'eclaire — et une discussion de cent
                  messages repousserait tout le reste hors de portee. */}
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
                {thread.map((entry) => {
                  const focused = entry.id === focusCommentId;
                  return (
                    <li
                      key={entry.id}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs",
                        // Le décalage dit « ceci répond à ce qui précède » sans
                        // un mot. Un seul niveau (0093), donc un seul cran.
                        entry.isReply && "ms-6 border-s-2 border-border ps-2",
                        focused ? "bg-brand/10 ring-1 ring-brand/40" : "bg-muted/30",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/admin/utilisateurs/${entry.authorId}`}
                          className="font-medium hover:text-brand"
                        >
                          {entry.authorName}
                        </Link>
                        {focused ? <StatusPill tone="brand">{t.threadFocus}</StatusPill> : null}
                        {entry.moderationStatus && entry.moderationStatus !== "approuve" ? (
                          <StatusPill tone="warning">{t.threadPending}</StatusPill>
                        ) : null}
                        {entry.isHidden ? <StatusPill tone="warning">{t.hidden}</StatusPill> : null}
                        {entry.isDeleted ? <StatusPill tone="danger">{t.deleted}</StatusPill> : null}
                      </div>
                      <p className="mt-0.5 whitespace-pre-line text-muted-foreground">
                        {entry.content}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* Le motif du refus n'est repete ici que si le bandeau ne l'a pas
              deja dit : l'appelant qui passe `why` le porte deja, et l'ecrire
              deux fois ferait douter qu'il s'agisse du meme refus. */}
          {!subject.why?.length &&
          subject.moderationStatus === "refuse" &&
          subject.moderationReason ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="font-semibold">{t.refusedFor}</span> {subject.moderationReason}
            </p>
          ) : null}

          {refusing ? (
            <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
              <Label htmlFor={`refuse-${subject.id}`}>{t.reasonLabel}</Label>
              <Textarea
                id={`refuse-${subject.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t.reasonPlaceholder}
                rows={3}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t.reasonHint}</p>
            </div>
          ) : null}
        </div>

        {/* ⚠️ `DialogFooter` est `flex-col-reverse` par defaut : sur telephone le
            groupe destructeur (masquer / supprimer) serait passe AU-DESSUS du
            groupe de validation, c'est-a-dire le geste irreversible en premier
            sous le pouce. On impose `flex-col` pour garder l'ordre du DOM. */}
        <DialogFooter className="flex-col gap-2 border-t border-border/70 bg-popover px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-2">
            {canValidate && subject.moderationStatus && subject.moderationStatus !== "approuve" ? (
              <Button
                size="sm"
                disabled={busy || refusing}
                onClick={() => run("approve", onApprove)}
              >
                {spin("approve") ?? <CheckIcon />}
                {t.approve}
              </Button>
            ) : null}

            {canValidate && subject.moderationStatus && !refusing ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setRefusing(true)}
              >
                <XIcon />
                {t.refuse}
              </Button>
            ) : null}

            {canValidate && refusing ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy || !motif}
                  onClick={() => run("refuse", () => onRefuse(motif))}
                >
                  {spin("refuse") ?? <XIcon />}
                  {t.confirmRefuse}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setRefusing(false);
                    setReason("");
                  }}
                >
                  {dict.common.cancel}
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Masquer et supprimer restent ouverts a `moderation.manage` :
                ce sont des gestes de moderation, pas de validation. La page
                ne rend cette popup qu'a qui detient deja ce droit. */}
            <Button
              size="sm"
              variant="outline"
              disabled={busy || refusing}
              onClick={() => run("hide", onToggleHidden, false)}
            >
              {spin("hide") ?? (subject.isHidden ? <EyeIcon /> : <EyeOffIcon />)}
              {subject.isHidden ? t.unhide : t.hide}
            </Button>
            <Button
              size="sm"
              variant={subject.isDeleted ? "outline" : "destructive"}
              disabled={busy || refusing}
              onClick={() => run("delete", onToggleDeleted)}
            >
              {spin("delete") ?? (subject.isDeleted ? <Undo2Icon /> : <Trash2Icon />)}
              {subject.isDeleted ? t.restore : t.delete}
            </Button>
            <DialogClose render={<Button type="button" variant="ghost" size="sm" />}>
              {dict.common.close}
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
