import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

import { BlogContent } from "@/components/site/blog-content";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { getLocale } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { getPublishedBlogPostBySlug } from "@/lib/queries/site-blog";
import { publicStorageUrl } from "@/lib/supabase/config";

// Contenu administre, mis a jour depuis /admin/blog : jamais de contenu figé
// a prerendre a la construction.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.meta_title || post.title} — Ifriqiya Soccer Star`,
    description: post.meta_description || post.excerpt || undefined,
    // Meme contenu sous les trois prefixes de langue (cf. /blog) : une seule
    // adresse canonique, sans prefixe, pour ne pas diviser le referencement.
    alternates: { canonical: localePath("fr", `/blog/${post.slug}`) },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();

  const locale = await getLocale();
  const prefix = locale === "fr" ? "" : `/${locale}`;
  const cover = publicStorageUrl("blog-media", post.cover_image_path);

  return (
    <div className="site-shell min-h-screen overflow-x-clip font-sans">
      <SiteNav />
      <main className="relative isolate">
        <div aria-hidden className="site-glow pointer-events-none absolute inset-0 -z-10 opacity-40" />
        <article className="mx-auto max-w-5xl px-5 pt-8 pb-16 sm:px-8 sm:pt-10 sm:pb-24">
          <Link
            href={`${prefix}/blog`}
            className="inline-flex items-center gap-2 text-xs text-(--site-muted) transition-colors hover:text-(--site-accent)"
          >
            <ArrowLeftIcon className="size-4 rtl:-scale-x-100" aria-hidden />
            Retour au blog
          </Link>

          {post.author_name || post.published_at ? (
            <p className="mt-8 text-xs font-medium tracking-wide text-(--site-muted) uppercase">
              {[
                post.author_name ? `Par ${post.author_name}` : null,
                post.published_at
                  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(post.published_at))
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <h1 className="font-heading mt-3 text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          {cover ? (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-3xl border border-(--site-line-strong)">
              <Image src={cover} alt="" fill sizes="(min-width: 1280px) 1024px, 100vw" className="object-cover" priority />
            </div>
          ) : null}

          <div className="mt-10">
            <BlogContent content={post.content} />
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
