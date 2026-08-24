import { cn } from "@/lib/utils";

/**
 * Tete de page : titre gras, sous-titre gris, action primaire a droite —
 * exactement le bloc « Dashboard Overview » de la maquette. Pas de sur-titre
 * en capitales : la reference n'en a pas.
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  /**
   * Petit intitule au-dessus du titre. La maquette n'en a pas ; il est conserve
   * parce que plusieurs ecrans s'en servent pour situer la section, mais rendu
   * en gris et en casse normale plutot qu'en capitales lime.
   */
  kicker?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {kicker ? <p className="text-xs text-muted-foreground">{kicker}</p> : null}
        <h1 className="font-heading text-xl leading-tight font-extrabold sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Titre de section avec son lien « voir tout », entre deux blocs de la page. */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="font-heading text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}
