"use client";

import * as React from "react";
import { ImageIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { createClient } from "@/lib/supabase/client";
import { publicStorageUrl } from "@/lib/supabase/config";

/** Au-dela, un courriel devient lourd a charger sur un forfait mobile. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Depot d'une image de courriel : navigateur -> bucket `email-media`.
 *
 * ⚠️ **Bucket public, et il doit l'etre** : un client de messagerie charge
 * l'image sans session et ne sait pas suivre une URL signee. C'est pourquoi
 * il est distinct des buckets prives du back-office, et pourquoi il ne doit
 * recevoir que des visuels destines a etre publics.
 *
 * Distinct de `blog-media` aussi : celui-la est garde par `blog.manage`, qui
 * n'est pas la permission de qui compose un courriel.
 */
export function ImageUploadButton({
  onUploaded,
  disabled,
}: {
  onUploaded: (url: string) => void;
  disabled?: boolean;
}) {
  const i18n = useAdminTranslations();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(i18n.t("Image trop lourde : 2 Mo au maximum."));
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      // Prefixe aleatoire : deux images du meme nom ne doivent jamais
      // s'ecraser l'une l'autre dans un bucket partage par tous les modeles.
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("email-media")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const url = publicStorageUrl("email-media", path);
      if (url) onUploaded(url);
    } catch (error) {
      // Le detail brut est garde : c'est lui qui nomme la vraie cause
      // (bucket absent, policy de stockage, reseau), la ou un message
      // generique aurait oblige a revenir ici pour comprendre.
      const detail = error instanceof Error ? error.message : String(error);
      toast.error(`${i18n.t("Le depot de l'image a echoue.")} ${detail}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-semibold hover:bg-accent/70 disabled:opacity-60"
      >
        {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
        {i18n.t("Deposer une image")}
      </button>
    </>
  );
}
