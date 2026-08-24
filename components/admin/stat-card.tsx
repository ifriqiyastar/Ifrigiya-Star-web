import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tuile d'indicateur, calquee sur la maquette : pastille d'icone circulaire en
 * degrade lime a gauche, libelle a cote, fleche discrete en haut a droite,
 * grand nombre, puis une pastille de variation suivie d'une precision grise.
 * Un halo radial diffus occupe le bas de la carte.
 *
 * `glow` choisit la teinte du halo — la maquette alterne le vert de marque et
 * un turquoise sur la derniere tuile de la rangee.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = "brand",
  hint,
  icon: Icon,
  glow = "lime",
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Variation mise en avant dans une pastille (« +12,5 % »). */
  delta?: string;
  deltaTone?: "brand" | "danger" | "neutral";
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  glow?: "lime" | "teal" | "none";
  /** `brand` passe la valeur en lime, pour la tuile qui doit dominer la rangee. */
  tone?: "default" | "brand";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-white/5 sm:p-5",
        className,
      )}
    >
      {glow !== "none" ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            glow === "teal" ? "glow-teal" : "glow-lime",
          )}
        />
      ) : null}

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  glow === "teal"
                    ? "bg-gradient-to-br from-teal-300 to-teal-500 text-black"
                    : "bg-brand-gradient text-brand-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
            ) : null}
            <p className="truncate text-sm text-muted-foreground">{label}</p>
          </div>
          <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
        </div>

        <p
          className={cn(
            "font-heading text-3xl leading-none font-extrabold tabular-nums",
            tone === "brand" && "text-brand",
          )}
        >
          {value}
        </p>

        {delta || hint ? (
          <div className="flex flex-wrap items-center gap-2">
            {delta ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                  deltaTone === "danger"
                    ? "bg-destructive text-white"
                    : deltaTone === "neutral"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-brand-gradient text-brand-foreground",
                )}
              >
                {delta}
              </span>
            ) : null}
            {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
