import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

/**
 * Pastille d'etat de la maquette : petite, coins entierement arrondis, **casse
 * normale** (la maquette n'utilise nulle part de capitales espacees).
 *
 * Deux traitements, comme la reference : *plein* pour ce qui doit sauter aux
 * yeux (a traiter, refuse) et *discret* — fond sourd, bord tenu — pour les
 * etats de simple information. Un point colore precede les etats discrets, de
 * facon que la couleur ne soit jamais le seul porteur du sens.
 */
const pill = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] leading-none font-medium [&>svg]:size-3",
  {
    variants: {
      tone: {
        brand: "bg-brand-gradient font-semibold text-brand-foreground",
        danger: "bg-[var(--danger-surface,var(--destructive))] font-semibold text-[#e1e2e8]",
        warning: "bg-warning/12 text-warning",
        success: "bg-success/12 text-success",
        info: "bg-info/12 text-info",
        neutral: "bg-secondary text-muted-foreground",
      },
      dot: { true: "", false: "" },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const DOT: Record<Tone, string> = {
  brand: "bg-brand-foreground/70",
  danger: "bg-card-foreground/80",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function StatusPill({
  children,
  tone = "neutral",
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  /** Affiche le point de couleur devant le libelle (etats « en direct »). */
  dot?: boolean;
  className?: string;
} & VariantProps<typeof pill>) {
  return (
    <span className={cn(pill({ tone }), className)}>
      {dot ? <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} /> : null}
      {children}
    </span>
  );
}
