import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlertIcon } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Acces refuse" };

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
}: PageProps<"/admin/acces-refuse">) {
  await requireAdmin();
  const resolved = await searchParams;
  const droit = typeof resolved.droit === "string" ? resolved.droit : null;

  return (
    <>
      <PageHeader
        kicker="Securite"
        title="Acces refuse"
        description="Votre compte est bien administrateur, mais le role qui lui est attribue ne porte pas le droit necessaire a cet ecran."
      />

      <Panel>
        <div className="flex flex-col items-start gap-4 p-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <ShieldAlertIcon className="size-5 text-foreground/70" />
          </span>

          {droit ? (
            <p className="text-sm">
              Droit manquant : <code className="text-xs">{droit}</code>
            </p>
          ) : null}

          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Deux causes possibles, et la seconde est la plus frequente en cours de
              deploiement :
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                votre role d&apos;administrateur ne comporte pas ce droit — un super
                administrateur doit vous en attribuer un autre dans
                <code className="mx-1 text-xs">admin_user_roles</code> ;
              </li>
              <li>
                <strong>aucun role RBAC ne vous est attribue.</strong> C&apos;est le cas d&apos;un
                compte promu administrateur apres l&apos;application de la migration
                <code className="mx-1 text-xs">202608240001_admin_platform.sql</code>, qui
                n&apos;attribue le role qu&apos;aux administrateurs existant a ce moment-la.
              </li>
            </ul>
          </div>

          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
            Retour au tableau de bord
          </Link>
        </div>
      </Panel>
    </>
  );
}
