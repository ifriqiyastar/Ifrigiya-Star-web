import { getAdminI18n } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/**
 * Colonne « dossier actif » des maquettes de septembre 2026 : la file de
 * validation a gauche, le dossier de la ligne selectionnee a droite, avec les
 * gestes de decision au pied de la colonne.
 *
 * POURQUOI PLUTOT QU'UNE MODALE. Le dossier vivait dans un `DetailDialog` : il
 * fallait l'ouvrir, le lire, le fermer, puis viser le bon bouton sur la ligne.
 * Ici la piece d'identite, les controles de conformite et le bouton « Valider »
 * sont visibles ensemble, ce qui est exactement la promesse de la maquette.
 *
 * La selection vit dans l'URL (`?dossier=<id>`), comme tous les etats de cet
 * ecran : la page reste un Server Component, le dossier est partageable par
 * lien, et le retour navigateur fonctionne.
 */
export function DossierRail({
  reference,
  title,
  status,
  children,
  actions,
  footnote,
  className,
}: {
  /** Petit identifiant technique affiche en capitales au-dessus du titre. */
  reference: string;
  title: string;
  /** Pastille d'etat du dossier, a droite de la reference. */
  status?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        // `sticky` : la file de gauche peut etre longue, le dossier reste en
        // vue pendant qu'on la parcourt.
        "flex flex-col gap-4 self-start rounded-xl border border-border bg-card p-4 xl:sticky xl:top-4",
        className,
      )}
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="micro-label text-muted-foreground">{reference}</p>
          {status}
        </div>
        <h2 className="font-heading text-lg leading-tight font-extrabold">{title}</h2>
      </header>

      <div className="space-y-4">{children}</div>

      {actions ? <div className="flex flex-col gap-2 border-t border-border pt-4">{actions}</div> : null}

      {footnote ? (
        <p className="rounded-lg border border-border bg-background/60 p-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </aside>
  );
}

/**
 * Liste de controles de conformite : une ligne par verification, avec son
 * verdict a droite. Chaque ligne doit correspondre a une donnee reellement
 * lue en base — une pastille verte qui ne verifie rien est pire qu'aucune
 * pastille.
 */
export async function ComplianceList({
  items,
}: {
  items: { label: string; verdict: string; tone: "success" | "warning" | "danger" | "neutral" }[];
}) {
  const i18n = await getAdminI18n();

  const dot = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    neutral: "bg-muted-foreground",
  } as const;
  const text = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    neutral: "text-muted-foreground",
  } as const;

  return (
    <section className="space-y-1.5">
      <p className="micro-label text-muted-foreground">{i18n.t("Controles de conformite")}</p>
      <ul className="divide-y divide-border/70 rounded-lg border border-border">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 px-3 py-2">
            <span className={cn("size-1.5 shrink-0 rounded-full", dot[item.tone])} />
            <span className="min-w-0 flex-1 truncate text-xs">{item.label}</span>
            <span className={cn("shrink-0 text-[0.6875rem] font-medium", text[item.tone])}>
              {item.verdict}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
