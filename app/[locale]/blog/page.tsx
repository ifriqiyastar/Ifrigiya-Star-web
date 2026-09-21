import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRightIcon, NewspaperIcon } from "lucide-react";

import { Pill, SectionHeading } from "@/components/site/pieces";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { getLocale } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { listPublishedBlogPosts, type PublicBlogPostSummary } from "@/lib/queries/site-blog";
import { publicStorageUrl } from "@/lib/supabase/config";

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
  return {
    title: "Blog — Ifriqiya Soccer Star",
    description: "Actualites, conseils et coulisses d'Ifriqiya Soccer Star.",
    alternates: { canonical: localePath("fr", "/blog") },
  };
}

// Contenu administre, mis a jour depuis /admin/blog : jamais de contenu figé
// a prerendre a la construction.
export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await listPublishedBlogPosts();
  // Le contenu reste francais, mais les liens internes doivent porter le
  // prefixe de langue du visiteur : sans lui, cliquer sur un article depuis
  // /en ou /ar ramenerait l'entete et le pied de page en francais aussi.
  const locale = await getLocale();
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

          {!posts.length ? (
            <p className="mx-auto mt-14 flex max-w-md flex-col items-center gap-3 text-center text-sm text-(--site-muted)">
              <NewspaperIcon className="size-6 text-(--site-accent)" aria-hidden />
              Aucun article publie pour le moment.
            </p>
          ) : (
            <div className="mt-14 space-y-10">
              {/* L'article le plus recent en grand format : avec un seul
                  article publie, une grille a trois colonnes le laissait
                  seul dans un coin et la page paraissait a moitie vide. En
                  vedette, ce meme article remplit intentionnellement la
                  largeur, et l'effet tient tout autant une fois qu'il y en a
                  plusieurs. */}
              <FeaturedPost post={posts[0]} prefix={prefix} />

              {posts.length > 1 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.slice(1).map((post, index) => (
                    <PostCard key={post.id} post={post} prefix={prefix} delay={Math.min(index, 5) * 80} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Le dernier article publie, en grand format au-dessus de la grille. */
function FeaturedPost({ post, prefix }: { post: PublicBlogPostSummary; prefix: string }) {
  const cover = publicStorageUrl("blog-media", post.cover_image_path);

  return (
    <Reveal as="article">
      <Link
        href={`${prefix}/blog/${post.slug}`}
        className="group block overflow-hidden rounded-3xl border border-(--site-line-strong) bg-(--site-card) transition-colors hover:border-(--site-accent)/50"
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-black/40 sm:aspect-[21/9]">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(min-width: 1024px) 1152px, 100vw"
              priority
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : null}
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
        </div>
        <div className="flex flex-col gap-3 p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Pill>A la une</Pill>
            <span className="text-xs font-medium tracking-wide text-(--site-muted) uppercase">
              {[post.author_name, post.published_at ? formatPostDate(post.published_at) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <h2 className="font-heading max-w-3xl text-2xl leading-[1.1] font-extrabold text-balance group-hover:text-(--site-accent) sm:text-3xl lg:text-4xl">
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-(--site-muted) sm:text-base">
              {post.excerpt}
            </p>
          ) : null}
          <span className="mt-2 inline-flex w-fit items-center gap-2 text-sm font-semibold text-(--site-accent)">
            Lire l&apos;article
            <ArrowUpRightIcon className="size-4 rtl:-scale-x-100" aria-hidden />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

/** Une vignette d'article, dans la grille sous l'article vedette. */
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
