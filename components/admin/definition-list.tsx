import { cn } from "@/lib/utils";

/**
 * Liste de champs d'une fiche (compte, Scout Day, signalement). Une colonne
 * sur mobile, deux a partir de `sm` — la donnee reste lisible sans
 * defilement horizontal.
 */
export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-1">
          <dt className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {item.label}
          </dt>
          <dd className="text-sm break-words text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
