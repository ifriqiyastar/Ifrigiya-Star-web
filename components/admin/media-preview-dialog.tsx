"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import { ExternalLinkIcon, PlayIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Apercu d'un media dans une modale : image, video hebergee, ou video YouTube.
 *
 * `DocumentPreviewDialog` fait la meme chose pour un justificatif — un
 * `<iframe>` sur une URL signee, ce qui convient a un PDF ou a un scan. Il ne
 * convient pas a un media : une video demande un `<video controls>`, une image
 * demande a etre vue **entiere** et non recadree, et une video YouTube demande
 * son lecteur.
 *
 * ⚠️ Chaque bucket a son mode d'acces, verifie contre `storage.buckets` :
 * `player-videos` et `post-media` sont **publics** (URL directe),
 * `player-photos` et `player-cv` sont **prives** et passent par la route
 * `/admin/documents`, qui signe l'acces avec la session administrateur. Se
 * tromper donne une image qui ne charge jamais, sans erreur visible.
 */
type Kind = "image" | "video" | "youtube";

/**
 * L'identifiant d'une video YouTube, quelle que soit la forme de l'URL que
 * l'application mobile a enregistree (`watch?v=`, `youtu.be/`, `/embed/`).
 * Nul si la forme est inconnue : on retombe alors sur un simple lien plutot
 * que de charger un lecteur vide.
 */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match?.[1] ?? null;
}

export function MediaPreviewDialog({
  kind,
  url,
  label,
  description,
  trigger,
}: {
  kind: Kind;
  /** URL directe (bucket public), URL signee (`/admin/documents`), ou lien YouTube. */
  url: string;
  label: string;
  description?: string;
  /** Declencheur personnalise — une vignette, par exemple. */
  trigger?: React.ReactNode;
}) {
  const i18n = useAdminTranslations();

  const videoId = kind === "youtube" ? youtubeId(url) : null;

  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "cursor-pointer rounded-lg text-left transition-opacity hover:opacity-85",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
        aria-label={i18n.t("Apercu : {0}", { "0": label })}
      >
        {trigger ?? (
          <span className="inline-flex items-center gap-1.5 text-sm hover:text-brand">
            <PlayIcon className="size-3.5" />
            {i18n.t("Apercu")}</span>
        )}
      </DialogTrigger>

      <DialogContent className="gap-4 p-4 sm:max-w-4xl sm:p-5">
        <DialogHeader className="pr-12">
          <DialogTitle className="normal-case tracking-normal">{label}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{description ?? i18n.t("Verifiez le media avant de prendre une decision.")}</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand"
            >
              {i18n.t("Ouvrir dans un onglet")}<ExternalLinkIcon className="size-3.5" />
            </a>
          </DialogDescription>
        </DialogHeader>

        {kind === "image" ? (
          // `object-contain` et non `cover` : une vignette recadree suffit a
          // reconnaitre une photo, pas a la moderer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="max-h-[70dvh] w-full rounded-xl bg-black object-contain"
          />
        ) : null}

        {kind === "video" ? (
          <video
            src={url}
            controls
            preload="metadata"
            className="max-h-[70dvh] w-full rounded-xl bg-black"
          />
        ) : null}

        {kind === "youtube" ? (
          videoId ? (
            <iframe
              // `youtube-nocookie` : un back-office n'a pas a deposer les
              // cookies publicitaires de YouTube dans la session d'un
              // administrateur pour visionner une video de joueur.
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={label}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video w-full rounded-xl bg-black"
            />
          ) : (
            <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {i18n.t("Lien YouTube non reconnu : aucun identifiant de video n'a pu en etre extrait. Ouvrez-le dans un onglet pour le verifier.")}</p>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
