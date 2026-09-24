"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
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
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  canValidate,
  trigger,
  statusLabel,
  onApprove,
  onRefuse,
  onToggleHidden,
  onToggleDeleted,
}: {
  post: PreviewPost;
  /** `content.validate` — super administrateur. Cache valider / refuser. */
  canValidate: boolean;
  trigger: React.ReactNode;
  /** Libelle et ton de l'etat de validation, resolus par la page (labels FR/EN). */
  statusLabel?: { label: string; tone: "warning" | "success" | "danger" };
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
  const { dict } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [refusing, setRefusing] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const t = dict.postPreview;
  const motif = reason.trim();

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
      <DialogContent className="max-h-[90svh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* ⚠️ PAS de `<UserCell>` ici : c'est un Server Component (il `await`
              le dictionnaire), et l'importer depuis ce fichier client tire
              `lib/i18n/admin.ts` — donc `server-only` — dans le bundle
              navigateur. Le meme test qui a attrape les actions attrape
              celui-la. On redessine donc l'identite a l'identique. */}
          <Link
            href={`/admin/utilisateurs/${post.author.id}`}
            className="flex min-w-0 items-center gap-3 rounded-md outline-none hover:opacity-80"
          >
            <Avatar className="size-9 shrink-0 rounded-full">
              {post.author.avatarUrl ? <AvatarImage src={post.author.avatarUrl} alt="" /> : null}
              <AvatarFallback className="rounded-full bg-accent text-[0.625rem] font-semibold tracking-wider">
                {initials(post.author.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {post.author.name}
              </span>
              {post.author.email ? (
                <span className="truncate text-xs text-muted-foreground">{post.author.email}</span>
              ) : null}
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {statusLabel ? (
              <StatusPill tone={statusLabel.tone}>{statusLabel.label}</StatusPill>
            ) : null}
            {post.isHidden ? <StatusPill tone="warning">{t.hidden}</StatusPill> : null}
            {post.isDeleted ? <StatusPill tone="danger">{t.deleted}</StatusPill> : null}
          </div>
        </div>

        {/* Le texte integral, dans sa propre zone defilante : une publication
            longue ne doit pas repousser les boutons hors de l'ecran. */}
        <p className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-line">
          {post.content?.trim() ? post.content : t.noText}
        </p>

        {post.mediaUrl && post.mediaType === "photo" ? (
          <div className="flex justify-center rounded-lg border border-border bg-background p-2">
            {/* ⚠️ `<img>` et non `next/image` : la source est la route
                `/admin/documents`, qui **redirige** vers une URL signee de
                Supabase Storage. L'optimiseur de Next voudrait aller chercher
                l'original lui-meme, sur un hote qui n'est pas declare dans
                `next.config.ts` — il rendrait 400 sur une image valide. */}
            {/* `max-w-full` est redondant — MESURE : le preflight de Tailwind
                pose deja `img { max-width: 100% }`, et une image 16:9 rendue a
                256 px de haut tient a 228 px dans une popup de 288. On le
                garde comme intention locale, pas comme correctif : ne pas
                croire, sur la foi de cette ligne, qu'un debordement y a ete
                repare. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.mediaUrl}
              alt=""
              className="max-h-64 w-auto max-w-full rounded object-contain"
            />
          </div>
        ) : null}

        {post.mediaUrl && post.mediaType !== "photo" && post.mediaType !== "aucun" ? (
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

        {post.moderationStatus === "refuse" && post.moderationReason ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span className="font-semibold">{t.refusedFor}</span> {post.moderationReason}
          </p>
        ) : null}

        {refusing ? (
          <div className="space-y-2">
            <Label htmlFor={`refuse-${post.id}`}>{t.reasonLabel}</Label>
            <Textarea
              id={`refuse-${post.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t.reasonPlaceholder}
              rows={3}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t.reasonHint}</p>
          </div>
        ) : null}

        {/* ⚠️ `DialogFooter` est `flex-col-reverse` par defaut : sur telephone le
            groupe destructeur (masquer / supprimer) serait passe AU-DESSUS du
            groupe de validation, c'est-a-dire le geste irreversible en premier
            sous le pouce. On impose `flex-col` pour garder l'ordre du DOM. */}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {canValidate && post.moderationStatus && post.moderationStatus !== "approuve" ? (
              <Button
                size="sm"
                disabled={busy || refusing}
                onClick={() => run("approve", onApprove)}
              >
                {spin("approve") ?? <CheckIcon />}
                {t.approve}
              </Button>
            ) : null}

            {canValidate && post.moderationStatus && !refusing ? (
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
              {spin("hide") ?? (post.isHidden ? <EyeIcon /> : <EyeOffIcon />)}
              {post.isHidden ? t.unhide : t.hide}
            </Button>
            <Button
              size="sm"
              variant={post.isDeleted ? "outline" : "destructive"}
              disabled={busy || refusing}
              onClick={() => run("delete", onToggleDeleted)}
            >
              {spin("delete") ?? (post.isDeleted ? <Undo2Icon /> : <Trash2Icon />)}
              {post.isDeleted ? t.restore : t.delete}
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
