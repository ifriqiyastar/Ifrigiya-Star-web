import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, NewspaperIcon, SearchIcon, XIcon } from "lucide-react";

import { SectionHeading, SitePagination } from "@/components/site/pieces";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { getLocale } from "@/lib/i18n/dictionaries";
import { localePath, ogImagePath } from "@/lib/i18n/config";
import {
  fetchBlogFacets,
  listPublishedBlogPosts,
  type BlogFacet,
  type PublicBlogPostSummary,
} from "@/lib/queries/site-blog";
import { isMobileRequest } from "@/lib/server-device";
import { publicStorageUrl } from "@/lib/supabase/config";

/** 6 articles par page sur telephone, 9 sur ordinateur (client request) — trois rangees pleines de trois sur la grille `lg:grid-cols-3`. */
const MOBILE_PAGE_SIZE = 6;
const DESKTOP_PAGE_SIZE = 9;

/** Toujours en francais : le contenu du blog l'est, quelle que soit la langue de l'entete/pied de page autour. */
const formatPostDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));

/** Pastille courte posee sur la vignette ("SEPT. 2026") — voir la note sur les categories plus bas. */
const formatBadgeDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(iso)).toUpperCase();

/**
 * Le blog est redige en francais uniquement (decision produit) : le contenu
 * reste le meme sous /blog, /en/blog et /ar/blog — seuls l'entete et le pied
 * de page suivent la langue choisie par le visiteur, via SiteNav/SiteFooter.
 * `canonical` pointe toujours vers l'URL sans prefixe : les trois adresses ne
 * doivent pas se battre entre elles pour le meme contenu aux yeux des moteurs
 * de recherche.
 */
export async function generateMetadata(): Promise<Metadata> {
  const title = "Blog — Ifriqiya Soccer Star";
  const description = "Actualites, conseils et coulisses d'Ifriqiya Soccer Star.";
  const images = [ogImagePath(await getLocale())];
  return {
    title,
    description,
    alternates: { canonical: localePath("fr", "/blog") },
    // Voir le commentaire equivalent dans `app/[locale]/page.tsx` : la fusion
    // de metadonnees est superficielle, `siteName`/`type` doivent revenir ici.
    openGraph: { title, description, siteName: "Ifriqiya Soccer Star", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

// Contenu administre, mis a jour depuis /admin/blog : jamais de contenu figé
// a prerendre a la construction.
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}

export default async function BlogIndexPage({ searchParams }: PageProps<"/[locale]/blog">) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number(firstParam(resolvedSearchParams.page)) || 1);
  const search = firstParam(resolvedSearchParams.q);
  const author = firstParam(resolvedSearchParams.auteur);
  const month = firstParam(resolvedSearchParams.mois);
  // Reporte sur chaque lien (pagination, filtres) pour ne jamais perdre les
  // autres criteres actifs en changeant l'un d'eux.
  const activeParams = { q: search, auteur: author, mois: month };

  const [mobile, locale] = await Promise.all([isMobileRequest(), getLocale()]);
  const pageSize = mobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [{ rows: posts, count }, facets] = await Promise.all([
    listPublishedBlogPosts({ page, pageSize, search, author, month }),
    fetchBlogFacets(),
  ]);
  // Le contenu reste francais, mais les liens internes doivent porter le
  // prefixe de langue du visiteur : sans lui, cliquer sur un article depuis
  // /en ou /ar ramenerait l'entete et le pied de page en francais aussi.
  const prefix = locale === "fr" ? "" : `/${locale}`;
  const basePath = `${prefix}/blog`;
  const hasActiveFilter = Boolean(search || author || month);

  return (
    <div className="site-shell min-h-screen overflow-x-clip font-sans">
      <SiteNav />
      <main className="relative isolate">
        <div aria-hidden className="site-glow pointer-events-none absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-8 sm:pt-10 sm:pb-24">
          <SectionHeading
            pill="Blog"
            title="Actualites d'Ifriqiya Soccer Star"
            lead="Detections, parcours de joueurs et coulisses de l'academie."
          />

          <div className="mt-14 grid gap-10 lg:grid-cols-[260px_1fr] lg:items-start lg:gap-12">
            <BlogSidebar basePath={basePath} search={search} author={author} month={month} facets={facets} />

            <div>
              <p className="mb-6 text-xs font-medium tracking-wide text-(--site-muted) uppercase">
                {count} {count > 1 ? "articles" : "article"}
                {hasActiveFilter ? (count > 1 ? " trouves" : " trouve") : ""}
              </p>

              {!count ? (
                <p className="flex flex-col items-center gap-3 py-14 text-center text-sm text-(--site-muted)">
                  <NewspaperIcon className="size-6 text-(--site-accent)" aria-hidden />
                  {hasActiveFilter
                    ? "Aucun article ne correspond a ces filtres."
                    : "Aucun article publie pour le moment."}
                  {hasActiveFilter ? (
                    <Link href={basePath} className="font-semibold text-(--site-accent) hover:underline">
                      Reinitialiser les filtres
                    </Link>
                  ) : null}
                </p>
              ) : (
                <>
                  <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                    {posts.map((post, index) => (
                      <PostCard key={post.id} post={post} prefix={prefix} delay={Math.min(index, 5) * 80} />
                    ))}
                  </div>
                  <SitePagination basePath={basePath} page={page} pageSize={pageSize} total={count} params={activeParams} />
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Recherche + filtres par auteur et par mois. Pas de filtre par categorie :
 * `blog_posts` n'en a pas (ni colonne, ni table separee), et en inventer un
 * cote ecran afficherait des categories que rien en base ne soutient — voir
 * la meme regle appliquee ailleurs sur ce site (pas de chiffre d'audience
 * invente, pas de badge sans donnee reelle derriere, cf. CLAUDE.md).
 *
 * Formulaire GET natif et liens simples plutot qu'un composant client : la
 * page reste un Server Component, l'etat vit entierement dans l'URL, et un
 * lien de filtre reste partageable et fonctionne au retour navigateur.
 */
function BlogSidebar({
  basePath,
  search,
  author,
  month,
  facets,
}: {
  basePath: string;
  search: string | undefined;
  author: string | undefined;
  month: string | undefined;
  facets: { authors: BlogFacet[]; months: BlogFacet[] };
}) {
  const href = (overrides: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const merged = { q: search, auteur: author, mois: month, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <aside className="flex flex-col gap-6">
      <form action={basePath} method="get" role="search" className="relative">
        {author ? <input type="hidden" name="auteur" value={author} /> : null}
        {month ? <input type="hidden" name="mois" value={month} /> : null}
        <SearchIcon className="pointer-events-none absolute top-1/2 start-4 size-4 -translate-y-1/2 text-(--site-muted)" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Rechercher un article..."
          className="w-full rounded-full border border-(--site-line-strong) bg-(--site-card) py-2.5 ps-11 pe-4 text-sm text-(--site-fg) placeholder:text-(--site-muted) focus:border-(--site-accent) focus:outline-none"
        />
      </form>

      {search || author || month ? (
        <Link
          href={basePath}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-(--site-muted) transition-colors hover:text-(--site-accent)"
        >
          <XIcon className="size-3.5" aria-hidden />
          Reinitialiser les filtres
        </Link>
      ) : null}

      <FilterGroup title="Dates" items={facets.months} activeValue={month} paramName="mois" href={href} />
      <FilterGroup title="Auteurs" items={facets.authors} activeValue={author} paramName="auteur" href={href} />
    </aside>
  );
}

/** Un groupe de filtres repliable (`<details>` natif — pas de JS necessaire). */
function FilterGroup({
  title,
  items,
  activeValue,
  paramName,
  href,
}: {
  title: string;
  items: BlogFacet[];
  activeValue: string | undefined;
  paramName: string;
  href: (overrides: Record<string, string | undefined>) => string;
}) {
  if (items.length === 0) return null;

  return (
    <details open className="group border-t border-(--site-line) pt-5">
      <summary className="micro-label flex cursor-pointer list-none items-center justify-between text-(--site-fg) marker:content-none">
        {title}
        <span aria-hidden className="text-(--site-muted) transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <ul className="mt-4 flex flex-col gap-2.5">
        {items.map((item) => {
          const active = activeValue === item.value;
          return (
            <li key={item.value}>
              <Link
                href={href({ [paramName]: active ? undefined : item.value })}
                className={`flex items-center justify-between gap-3 text-sm transition-colors ${
                  active ? "font-bold text-(--site-accent)" : "text-(--site-muted) hover:text-(--site-fg)"
                }`}
              >
                <span className="capitalize">{item.label}</span>
                <span className="text-xs tabular-nums">{item.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** La ligne "auteur · date" partagee entre les deux formats de carte. */
function PostMeta({ post, className }: { post: PublicBlogPostSummary; className: string }) {
  if (!post.author_name && !post.published_at) return null;
  return (
    <span className={className}>
      {[post.author_name, post.published_at ? formatPostDate(post.published_at) : null]
        .filter(Boolean)
        .join(" · ")}
    </span>
  );
}

/** Une vignette d'article : pastille de date sur l'image, texte en dessous. */
function PostCard({
  post,
  prefix,
  delay,
}: {
  post: PublicBlogPostSummary;
  prefix: string;
  delay: number;
}) {
  const cover = publicStorageUrl("blog-media", post.cover_image_path);

  return (
    <Reveal as="article" delay={delay}>
      <Link href={`${prefix}/blog/${post.slug}`} className="group flex h-full flex-col gap-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black/40">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(min-width: 1280px) 320px, (min-width: 640px) 45vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null}
          {post.published_at ? (
            <span className="absolute start-3 top-3 rounded-full bg-(--site-accent) px-3 py-1 text-[0.625rem] font-extrabold tracking-wide text-black">
              {formatBadgeDate(post.published_at)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <PostMeta post={post} className="text-xs font-medium tracking-wide text-(--site-muted) uppercase" />
          <h3 className="font-heading text-base leading-snug font-extrabold text-balance group-hover:text-(--site-accent)">
            {post.title}
          </h3>
          {post.excerpt ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-(--site-muted)">
              {post.excerpt}
            </p>
          ) : null}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-bold text-(--site-accent)">
            Lire l'article
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100" aria-hidden />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}
