"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SubmitRow({
  pending,
  label ,
  children,
  /** Bouton inactif sans indicateur d'attente : rien n'est en cours, il n'y a
   * simplement rien a enregistrer (saisie incomplete ou hors bornes). */
  disabled,
}: {
  pending: boolean;
  label?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const i18n = useAdminTranslations();
  label ??= i18n.t("Enregistrer");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
      {children}
      <Button type="submit" size="sm" disabled={pending || disabled}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}
