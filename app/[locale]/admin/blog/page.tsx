import { getAdminI18n } from "@/lib/i18n/admin";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { NewspaperIcon, PenLineIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Pagination } from "@/components/admin/pagination";
import { StatusPill } from "@/components/admin/status-pill";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { deleteBlogPost, unpublishBlogPost } from "@/lib/actions/blog";
import { requirePermission } from "@/lib/auth";
import { BLOG_STATUS } from "@/lib/labels";
import { listBlogPosts } from "@/lib/queries/blog";
import { publicStorageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Blog") };
}

export default async function BlogPage({ searchParams }: PageProps<"/[locale]/admin/blog">) {
  const i18n = await getAdminI18n();
  await requirePermission("blog.manage");

  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    statut: str(resolved.statut),
    page: str(resolved.page),
  };
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { rows, count, error } = await listBlogPosts({ q: params.q, statut: params.statut, page });

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Blog") }, { label: i18n.t("Articles") }]}
        title={i18n.t("Articles du blog")}
        description={i18n.t("Redigez, modifiez et publiez les articles visibles sur la page /blog du site public. Un brouillon n'est jamais visible en dehors de l'administration.")}
        actions={
          <Link href={i18n.path("/admin/blog/nouveau")} className={buttonVariants({ size: "sm" })}>
            <PlusIcon />
            {i18n.t("Nouvel article")}
          </Link>
        }
      />

      <Panel>
        <FilterBar
          basePath={i18n.path("/admin/blog")}
          params={params}
          searchPlaceholder={i18n.t("Rechercher un titre…")}
          filters={[
            { name: "statut", label: i18n.t("Statut"), options: i18n.labels.options(BLOG_STATUS) },
          ]}
        />

        {error ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
            {i18n.t("Lecture impossible :")} {error.message}
          </p>
        ) : null}

        {!rows.length ? (
          <EmptyState
            icon={NewspaperIcon}
            title={i18n.t("Aucun article")}
            description={i18n.t("Aucun article ne correspond a ces criteres.")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Article")}</TableHead>
                <TableHead>{i18n.t("Statut")}</TableHead>
                <TableHead>{i18n.t("Auteur")}</TableHead>
                <TableHead>{i18n.t("Derniere modification")}</TableHead>
                <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const cover = publicStorageUrl("blog-media", row.cover_image_path);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={i18n.path(`/admin/blog/${row.id}`)}
                        className="flex items-center gap-3 hover:text-brand"
                      >
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
                          {cover ? (
                            <Image src={cover} alt="" fill sizes="40px" className="object-cover" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-72 truncate font-medium">{row.title}</span>
                          <span className="block max-w-72 truncate text-xs text-muted-foreground">/blog/{row.slug}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={i18n.labels.entry(BLOG_STATUS, row.status).tone}>
                        {i18n.labels.label(BLOG_STATUS, row.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.author_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i18n.format.formatDateTime(row.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={i18n.path(`/admin/blog/${row.id}`)}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          <PenLineIcon />
                          {i18n.t("Modifier")}
                        </Link>
                        {row.status === "publie" ? (
                          <ActionButton action={unpublishBlogPost.bind(null, row.id)}>
                            {i18n.t("Depublier")}
                          </ActionButton>
                        ) : null}
                        <ActionButton
                          variant="ghost"
                          action={deleteBlogPost.bind(null, row.id)}
                          confirm={{
                            title: i18n.t("Supprimer cet article"),
                            description: i18n.t("L'article sera supprime definitivement, y compris s'il est publie."),
                            actionLabel: i18n.t("Supprimer definitivement"),
                          }}
                        >
                          <Trash2Icon />
                        </ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath={i18n.path("/admin/blog")}
          params={params}
          page={page}
          pageSize={20}
          total={count}
        />
      </Panel>
    </>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
