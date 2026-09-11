import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
      <p className="font-heading text-4xl font-extrabold text-brand">404</p>
      <h1 className="font-heading text-lg font-bold tracking-wider uppercase">
        Introuvable
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Cette fiche n&apos;existe pas ou a ete supprimee.
      </p>
      <Link href="/admin" className={cn(buttonVariants({ size: "sm" }))}>
        Retour au tableau de bord
      </Link>
    </div>
  );
}
