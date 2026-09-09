"use client";

import { ExternalLinkIcon, FileSearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DocumentPreviewDialog({
  url,
  label,
  compact = false,
}: {
  url: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          // Meme raison que les autres declencheurs : `Button` et
          // `DialogTrigger` posent chacun leur `data-slot`, et la fusion ne
          // tranche pas pareil serveur/client (erreur d'hydratation).
          <Button
            data-slot="dialog-trigger"
            type="button"
            variant={compact ? "ghost" : "outline"}
            size={compact ? "icon-xs" : "sm"}
            aria-label={`Apercu : ${label}`}
            title={`Apercu : ${label}`}
          />
        }
      >
        <FileSearchIcon />
        {compact ? null : <span className="max-w-40 truncate">{label}</span>}
      </DialogTrigger>
      <DialogContent className="grid h-[min(88dvh,56rem)] grid-rows-[auto_minmax(0,1fr)] gap-4 p-4 sm:max-w-5xl sm:p-5">
        <DialogHeader className="pr-12">
          <DialogTitle className="normal-case tracking-normal">{label}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Verifiez le document avant de prendre une decision.</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand"
            >
              Ouvrir dans un onglet
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </DialogDescription>
        </DialogHeader>
        <iframe
          src={url}
          title={label}
          className={cn(
            "min-h-0 size-full rounded-xl bg-white ring-1 ring-foreground/10",
            "supports-[height:1dvh]:h-full",
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
