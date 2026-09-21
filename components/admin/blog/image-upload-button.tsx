"use client";

import * as React from "react";
import { ImageIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { publicStorageUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Depot direct navigateur -> bucket `blog-media`, sans passer par une Server
 * Action : le bucket est public et sa policy d'ecriture verifie
 * `admin_has_permission('blog.manage')` cote Postgres
 * (`supabase/migrations/202609210001_blog.sql`), donc le fichier n'a pas
 * besoin de transiter par le serveur applicatif. Reutilise pour la couverture
 * et pour l'insertion d'image dans le corps de l'article — seul `onUploaded`
 * change de comportement d'un appelant a l'autre.
 */
export function ImageUploadButton({
  onUploaded,
  label,
  className,
}: {
  onUploaded: (url: string, path: string) => void;
  label: string;
  className?: string;
}) {
  const i18n = useAdminTranslations();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPending(true);
    try {
      const supabase = createClient();
      // Prefixe aleatoire : deux images du meme nom ne doivent jamais
      // s'ecraser l'une l'autre dans un bucket partage par tous les articles.
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("blog-media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;

      const url = publicStorageUrl("blog-media", path);
      if (url) onUploaded(url, path);
    } catch (error) {
      // Le detail brut est garde, meme sans traduction : c'est lui qui nomme
      // la vraie cause (bucket absent, RLS de stockage, reseau…), et un
      // message generique aurait fallu revenir ici pour comprendre pourquoi —
      // meme logique que `describeError()` pour les Server Actions.
      const detail = error instanceof Error ? error.message : String(error);
      toast.error(`${i18n.t("Le depot de l'image a echoue.")} ${detail}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-60",
          className,
        )}
      >
        {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </span>
  );
}
