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
        "overflow-hidden rounded-2xl bg-card ring-1 ring-white/5",
        highlighted && "ring-brand/40",
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
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="font-heading text-base font-bold">{title}</h2>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
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
