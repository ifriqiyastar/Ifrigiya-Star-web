import { getAdminI18n } from "@/lib/i18n/admin";
import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { requirePermission } from "@/lib/auth";
import { DEFAULT_BLOG_AUTHOR_NAME } from "@/lib/queries/blog";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Nouvel article") };
}

export default async function NewBlogPostPage() {
  const i18n = await getAdminI18n();
  const admin = await requirePermission("blog.manage");

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Blog"), href: i18n.path("/admin/blog") },
          { label: i18n.t("Nouvel article") },
        ]}
        title={i18n.t("Nouvel article")}
        description={i18n.t("Redigez l'article, puis enregistrez-le en brouillon ou publiez-le directement.")}
      />
      <PostEditor defaultAuthorName={admin.fullName ?? admin.email ?? DEFAULT_BLOG_AUTHOR_NAME} />
    </>
  );
}
