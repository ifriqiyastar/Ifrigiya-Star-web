import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { NewspaperIcon } from "lucide-react";

import { SectionHeading, SitePagination } from "@/components/site/pieces";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { getLocale } from "@/lib/i18n/dictionaries";
import { localePath, ogImagePath } from "@/lib/i18n/config";
import { listPublishedBlogPosts, type PublicBlogPostSummary } from "@/lib/queries/site-blog";
import { isMobileRequest } from "@/lib/server-device";
import { publicStorageUrl } from "@/lib/supabase/config";

/** 6 articles par page sur telephone, 9 sur ordinateur (client request) — trois rangees pleines de trois sur la grille `lg:grid-cols-3`. */
const MOBILE_PAGE_SIZE = 6;
const DESKTOP_PAGE_SIZE = 9;

/** Toujours en francais : le contenu du blog l'est, quelle que soit la langue de l'entete/pied de page autour. */
const formatPostDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));

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

export default async function BlogIndexPage({ searchParams }: PageProps<"/[locale]/blog">) {
  const resolvedSearchParams = await searchParams;
  const pageParam = resolvedSearchParams.page;
  const page = Math.max(1, Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1);

  const [mobile, locale] = await Promise.all([isMobileRequest(), getLocale()]);
  const pageSize = mobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const { rows: posts, count } = await listPublishedBlogPosts({ page, pageSize });
  // Le contenu reste francais, mais les liens internes doivent porter le
  // prefixe de langue du visiteur : sans lui, cliquer sur un article depuis
  // /en ou /ar ramenerait l'entete et le pied de page en francais aussi.
  const prefix = locale === "fr" ? "" : `/${locale}`;

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

          {!count ? (
            <p className="mx-auto mt-14 flex max-w-md flex-col items-center gap-3 text-center text-sm text-(--site-muted)">
              <NewspaperIcon className="size-6 text-(--site-accent)" aria-hidden />
              Aucun article publie pour le moment.
            </p>
          ) : (
            <>
              <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, index) => (
                  <PostCard key={post.id} post={post} prefix={prefix} delay={Math.min(index, 5) * 80} />
                ))}
              </div>
              <SitePagination basePath={`${prefix}/blog`} page={page} pageSize={pageSize} total={count} />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Une vignette d'article, dans la grille. */
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
      <Link
        href={`${prefix}/blog/${post.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-(--site-line-strong) bg-(--site-card) transition-colors hover:border-(--site-accent)/50"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw"
              priority={delay === 0}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-6">
          {post.author_name || post.published_at ? (
            <span className="text-xs font-medium tracking-wide text-(--site-muted) uppercase">
              {[post.author_name, post.published_at ? formatPostDate(post.published_at) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
          <h2 className="font-heading text-lg leading-snug font-extrabold text-balance group-hover:text-(--site-accent)">
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-(--site-muted)">
              {post.excerpt}
            </p>
          ) : null}
        </div>
      </Link>
    </Reveal>
  );
}
