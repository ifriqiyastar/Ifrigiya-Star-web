import { getAdminI18n } from "@/lib/i18n/admin";
import { ExternalLinkIcon, FileSearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Apercu d'une piece justificative **dans le flux de la page**, sans dialogue.
 *
 * `DocumentPreviewDialog` fait la meme chose dans une modale, ce qui convient
 * a une ligne de tableau. Il ne convient pas a l'interieur d'une modale :
 * deux dialogues superposes se disputent le focus et la touche Echap ferme le
 * mauvais. Le dossier de validation affiche donc la piece en place.
 *
 * L'`<iframe>` ne charge rien tant que la modale qui la contient n'est pas
 * ouverte — Base UI ne monte le contenu d'un dialogue qu'a l'ouverture — donc
 * une file de cent lignes ne signe pas cent URLs pour rien.
 */
export async function DocumentFrame({
  url,
  label,
  hint,
  className,
}: {
  url: string;
  label: string;
  hint?: string;
  className?: string;
}) {
  const i18n = await getAdminI18n();

  return (
    <figure className={cn("overflow-hidden rounded-xl border border-border", className)}>
      <figcaption className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2">
        <FileSearchIcon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        <span className="flex-1" />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          {i18n.t("Ouvrir dans un onglet")}<ExternalLinkIcon className="size-3" />
        </a>
      </figcaption>
      <iframe src={url} title={label} className="h-96 w-full bg-white" />
    </figure>
  );
}

/**
 * Le meme bandeau, sans l'apercu : pour une piece absente ou pour une liste
 * ou dix `<iframe>` seraient illisibles.
 */
export async function DocumentLink({
  url,
  label,
  hint,
}: {
  url: string | null;
  label: string;
  hint?: React.ReactNode;
}) {
  const i18n = await getAdminI18n();

  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
      <FileSearchIcon className="size-3.5 text-muted-foreground" />
      <span className="text-xs font-medium">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      <span className="flex-1" />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          {i18n.t("Ouvrir")}<ExternalLinkIcon className="size-3" />
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">{i18n.t("Aucun fichier")}</span>
      )}
    </span>
  );
}
