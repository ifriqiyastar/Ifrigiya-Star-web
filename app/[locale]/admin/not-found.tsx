import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { localePath } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export default async function AdminNotFound() {
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
      <p className="font-heading text-4xl font-extrabold text-brand">404</p>
      <h1 className="font-heading text-lg font-bold tracking-wider uppercase">
        {dict.notFound.title}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {dict.notFound.description}
      </p>
      <Link
        href={localePath(locale, "/admin")}
        className={cn(buttonVariants({ size: "sm" }))}
      >
        {dict.notFound.back}
      </Link>
    </div>
  );
}
