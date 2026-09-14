"use client";

import { CircleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fill } from "@/lib/i18n/admin-shared";
import { useAdminI18nSafe } from "@/lib/i18n/admin-client";

/**
 * Filet de securite du back-office. Le cas le plus probable est une variable
 * d'environnement Supabase manquante ou une erreur reseau vers la base : on
 * affiche le message plutot qu'un ecran blanc, avec un bouton pour reessayer.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Variante tolerante : si c'est la mise en page d'administration qui a
  // echoue, ce composant se rend **au-dessus** d'elle, donc hors du
  // fournisseur de langue. Jeter ici masquerait l'erreur reelle.
  const { dict } = useAdminI18nSafe();
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/20 text-destructive">
        <CircleAlertIcon className="size-5" />
      </span>
      <h1 className="font-heading text-lg font-bold tracking-wider uppercase">
        {dict.error.title}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {error.message || dict.error.fallback}
      </p>
      {error.digest ? (
        <p className="text-[0.6875rem] text-muted-foreground">
          {fill(dict.error.reference, { digest: error.digest })}
        </p>
      ) : null}
      <Button onClick={reset} size="sm">
        {dict.error.retry}
      </Button>
    </div>
  );
}
