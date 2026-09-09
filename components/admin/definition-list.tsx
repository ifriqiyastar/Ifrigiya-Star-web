import { cn } from "@/lib/utils";

export type DefinitionItem = {
  label: string;
  value: React.ReactNode;
  /**
   * Icone facultative. Presente, la ligne passe en pastille + libelle + valeur ;
   * absente, la mise en page d'origine est conservee — les fiches compte et
   * signalement n'ont pas eu a bouger.
   */
  icon?: React.ComponentType<{ className?: string }>;
};

/**
 * Liste de champs d'une fiche (compte, Scout Day, signalement). Une colonne
 * sur mobile, deux a partir de `sm` — la donnee reste lisible sans
 * defilement horizontal.
 *
 * L'icone est volontairement neutre (`text-foreground/70` sur `bg-secondary`)
 * et non lime : l'accent de marque est une couleur d'etat (bouton, onglet
 * actif). Repete sur dix lignes, il ne signifierait plus rien.
 */
export function DefinitionList({
  items,
  className,
}: {
  items: DefinitionItem[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-start gap-3">
          {item.icon ? (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <item.icon className="size-4 text-foreground/70" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <dt className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {item.label}
            </dt>
            <dd className="text-sm break-words text-foreground">{item.value ?? "—"}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
