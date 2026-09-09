import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * La surface du back-office, telle que la maquette la dessine : carte tres
 * arrondie, fond legerement plus clair que la page, **sans bordure franche** —
 * juste un liseré blanc a 5 % qui detache la carte du noir de la page.
 */
export function Panel({
  className,
  highlighted,
  ...props
}: React.ComponentProps<"section"> & { highlighted?: boolean }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        highlighted && "border-brand/40",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Icone de section, posee dans un carre sourd devant le titre. */
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand">
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          <h2 className="font-heading text-sm leading-tight font-bold sm:text-base">{title}</h2>
          {description ? (
            <p className="max-w-3xl text-[0.6875rem] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

/**
 * Lien discret aligne a droite d'un titre de section — le « View all » de la
 * maquette.
 */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs text-muted-foreground transition-colors hover:text-brand"
    >
      {children}
    </Link>
  );
}
