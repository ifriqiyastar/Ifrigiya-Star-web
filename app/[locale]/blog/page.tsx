import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, NewspaperIcon } from "lucide-react";

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
  const featuredPost = page === 1 ? posts[0] : undefined;
  const gridPosts = featuredPost ? posts.slice(1) : posts;

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
              {/* Le premier article de la premiere page se distingue du reste
                  — grand format, texte sur l'image — plutot que de rejoindre
                  une grille uniforme de vignettes identiques. Les pages
                  suivantes n'ont pas de "dernier article", donc pas de mise en avant. */}
              {featuredPost ? (
                <div className="mt-14">
                  <FeaturedPostCard post={featuredPost} prefix={prefix} />
                </div>
              ) : null}
              <div className={`grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 ${featuredPost ? "mt-12" : "mt-14"}`}>
                {gridPosts.map((post, index) => (
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

/**
 * L'article le plus recent de la premiere page, en grand : image plein
 * cadre, texte pose dessus plutot qu'une vignette de plus dans une grille de
 * vignettes identiques — c'est ce qui distingue ce format d'un simple
 * `PostCard` agrandi.
 */
function FeaturedPostCard({ post, prefix }: { post: PublicBlogPostSummary; prefix: string }) {
  const cover = publicStorageUrl("blog-media", post.cover_image_path);

  return (
    <Reveal>
      <Link
        href={`${prefix}/blog/${post.slug}`}
        className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-[2rem] border border-(--site-line-strong) bg-(--site-card) sm:min-h-[480px]"
      >
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="(min-width: 1280px) 1152px, 100vw"
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.92)_100%)]"
        />
        <div className="relative z-10 flex flex-col gap-4 p-7 sm:p-10">
          <span className="w-fit rounded-full bg-(--site-accent) px-4 py-1.5 text-[0.6875rem] font-extrabold tracking-wider text-black uppercase">
            Dernier article
          </span>
          <PostMeta post={post} className="text-xs font-medium tracking-wide text-white/60 uppercase" />
          <h2 className="font-heading max-w-2xl text-2xl leading-tight font-extrabold text-balance text-white sm:text-4xl">
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="max-w-xl line-clamp-2 text-sm leading-relaxed text-white/70 sm:text-base">
              {post.excerpt}
            </p>
          ) : null}
          <span className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-(--site-accent)">
            Lire l'article
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100" aria-hidden />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

/** Une vignette d'article, dans la grille : image nue, texte en dessous — pas de carte encadree. */
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
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
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
