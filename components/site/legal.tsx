import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";

/**
 * La coque commune aux pages legales (`/confidentialite`, `/conditions`).
 *
 * Extraite des la deuxieme page : deux copies du meme gabarit auraient
 * diverge au premier ajustement, et ces deux documents doivent justement se
 * ressembler — un visiteur passe de l'un a l'autre. Elle reprend telle quelle
 * la mise en page de `/contact` (coque `.site-shell`, `SiteNav`, halo,
 * `SiteFooter`), a une largeur pres : `max-w-3xl` au lieu de `max-w-7xl`,
 * parce qu'on lit ici un texte long et non une page en colonnes.
 */
export function LegalShell({
  prefix,
  back,
  pill,
  title,
  titleAccent,
  updated,
  lead,
  children,
}: {
  prefix: string;
  back: string;
  pill: string;
  title: string;
  titleAccent: string;
  updated: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell min-h-screen overflow-x-clip font-sans">
      <SiteNav />
      <main className="relative isolate">
        <div aria-hidden className="site-glow pointer-events-none absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-3xl px-5 pt-8 pb-16 sm:px-8 sm:pt-10 sm:pb-24">
          <Link
            href={prefix || "/"}
            className="inline-flex items-center gap-2 text-xs text-(--site-muted) transition-colors hover:text-(--site-accent)"
          >
            <ArrowLeftIcon className="size-4 rtl:-scale-x-100" aria-hidden />
            {back}
          </Link>

          <header className="mt-10 lg:mt-14">
            <p className="text-xs tracking-[0.2em] text-(--site-accent) uppercase">{pill}</p>
            <h1 className="mt-3 font-heading text-4xl leading-[1.08] font-extrabold sm:text-5xl">
              {title} <span className="text-(--site-accent)">{titleAccent}</span>
            </h1>
            <p className="mt-3 text-xs text-(--site-muted)">{updated}</p>
            <p className="mt-6 text-sm leading-relaxed text-(--site-muted) sm:text-base">{lead}</p>
          </header>

          <div className="mt-14">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-heading text-xl font-bold sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-(--site-muted) sm:text-base">
        {children}
      </div>
    </section>
  );
}

/**
 * Le bloc jaune des points que nous ne pouvons pas rediger a la place du
 * client : ils demandent une decision (duree de conservation, consentement du
 * representant legal d'un mineur, tarifs, droit applicable).
 *
 * Ils sont volontairement VISIBLES plutot que commentes dans le code : une
 * politique muette sur la conservation est deficiente de toute facon, et un
 * bloc invisible ne se fait jamais remplir. Ils doivent disparaitre avant que
 * ces URL servent de reference legale.
 */
export function LegalTodo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
      <div className="min-w-0 text-sm leading-relaxed">
        <p className="font-heading font-bold text-amber-500">{label}</p>
        <p className="mt-1 text-(--site-muted)">{children}</p>
      </div>
    </div>
  );
}

/** Liste de definitions a deux colonnes, empilee sur telephone. */
export function LegalRows({ rows }: { rows: readonly (readonly string[])[] }) {
  return (
    <dl className="divide-y divide-(--site-line) overflow-hidden rounded-lg border border-(--site-line)">
      {rows.map(([term, detail]) => (
        <div
          key={term}
          className="grid gap-1 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-6"
        >
          <dt className="font-heading text-sm font-bold text-(--site-fg)">{term}</dt>
          <dd className="text-sm">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Puces simples, reprises par les deux documents. */
export function LegalList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-2 ps-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
