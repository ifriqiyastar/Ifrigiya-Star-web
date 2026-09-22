import { getAdminI18n } from "@/lib/i18n/admin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { StatusPill } from "@/components/admin/status-pill";
import { requirePermission } from "@/lib/auth";
import { BLOG_STATUS } from "@/lib/labels";
import { DEFAULT_BLOG_AUTHOR_NAME, effectiveBlogStatus, getBlogPostById } from "@/lib/queries/blog";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/blog/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getBlogPostById(id);
  return { title: post?.title };
}

export default async function EditBlogPostPage({
  params,
}: PageProps<"/[locale]/admin/blog/[id]">) {
  const i18n = await getAdminI18n();
  await requirePermission("blog.manage");
  const { id } = await params;

  const post = await getBlogPostById(id);
  if (!post) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Blog"), href: i18n.path("/admin/blog") },
          { label: post.title },
        ]}
        title={post.title}
        meta={
          <StatusPill tone={i18n.labels.entry(BLOG_STATUS, effectiveBlogStatus(post)).tone}>
            {i18n.labels.label(BLOG_STATUS, effectiveBlogStatus(post))}
          </StatusPill>
        }
        description={post.author_name ? i18n.t("Redige par {0}", { "0": post.author_name }) : undefined}
      />
      <PostEditor
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          meta_title: post.meta_title,
          meta_description: post.meta_description,
          cover_image_path: post.cover_image_path,
          content: post.content,
          status: post.status,
          author_name: post.author_name,
          scheduled_at: post.scheduled_at,
        }}
        // Repli pour les articles crees avant l'ajout de ce champ
        // (`author_name` reste `null` ou vide en base pour eux) : sans lui,
        // un article plus ancien rouvert pour modification affichait un
        // champ Auteur vide. Fixe, pas l'identite de l'administrateur qui
        // rouvre l'article — le client veut "Administrateur Ifriqiya Soccer
        // Star" par defaut, modifiable au besoin.
        defaultAuthorName={DEFAULT_BLOG_AUTHOR_NAME}
      />
    </>
  );
}
