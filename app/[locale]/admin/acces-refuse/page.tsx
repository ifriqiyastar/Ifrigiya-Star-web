import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlertIcon } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { localePath } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAdminDict();
  return { title: dict.accessDenied.metaTitle };
}

/**
 * L'ecran de refus de permission — et **la seule page de `/admin` qui
 * n'exige aucune permission fine**, uniquement `requireAdmin()`.
 *
 * C'est tout l'objet de cette page. `requirePermission()` renvoyait vers
 * `/admin`, qui exige `dashboard.read` : un administrateur sans role RBAC
 * attribue echouait donc au meme controle a l'arrivee, etait renvoye vers
 * `/admin`, et ainsi de suite — une boucle de redirection dont aucun ecran ne
 * sortait. Un refus doit atterrir quelque part.
 */
export default async function AccesRefusePage({
  searchParams,
}: PageProps<"/[locale]/admin/acces-refuse">) {
  await requireAdmin();
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const d = dict.accessDenied;
  const resolved = await searchParams;
  const droit = typeof resolved.droit === "string" ? resolved.droit : null;

  return (
    <>
      <PageHeader
        kicker={d.kicker}
        title={d.title}
        description={d.description}
      />

      <Panel>
        <div className="flex flex-col items-start gap-4 p-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <ShieldAlertIcon className="size-5 text-foreground/70" />
          </span>

          {droit ? (
            <p className="text-sm">
              {d.missing} <code className="text-xs">{droit}</code>
            </p>
          ) : null}

          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>{d.intro}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {d.cause1a}
                <code className="mx-1 text-xs">admin_user_roles</code>;
              </li>
              <li>
                <strong>{d.cause2a}</strong> {d.cause2b}
                <code className="mx-1 text-xs">202608240001_admin_platform.sql</code>
                {d.cause2c}
              </li>
            </ul>
          </div>

          <Link
            href={localePath(locale, "/admin")}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {d.back}
          </Link>
        </div>
      </Panel>
    </>
  );
}
