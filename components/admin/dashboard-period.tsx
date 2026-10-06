"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { localePath } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * La periode du tableau de bord. Change la page des la selection — il n'y a
 * pas de bouton a valider — et la page se recalcule cote serveur : d'ou le
 * spinner, sans lequel le choix semblait sans effet pendant le recalcul.
 *
 * `useTransition` plutot qu'un etat pose a la main : il reste vrai jusqu'a
 * l'arrivee de la nouvelle page, pas seulement le temps d'envoyer la demande.
 * Le spinner occupe toujours sa place (`opacity`) pour ne rien decaler a
 * son apparition.
 *
 * Le segment de flux (`?flux=`) est conserve : changer de periode ne doit pas
 * remettre « Tous flux » a la place du filtre choisi juste a cote.
 */
export function DashboardPeriod({ value }: { value: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, dict } = useAdminI18n();
  const d = dict.dashboard;
  const [pending, startTransition] = React.useTransition();

  function choose(period: string) {
    const query = new URLSearchParams({ periode: period });
    const flux = searchParams.get("flux");
    if (flux) query.set("flux", flux);
    startTransition(() => {
      router.push(localePath(locale, `/admin?${query.toString()}`), { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <Loader2Icon
        aria-hidden
        className={cn(
          "size-4 animate-spin text-brand transition-opacity",
          pending ? "opacity-100" : "opacity-0",
        )}
      />
      <NativeSelect
        aria-label={d.periodLabel}
        value={String(value)}
        disabled={pending}
        onChange={(event) => choose(event.target.value)}
        className="h-9 min-w-40 rounded-md border border-border bg-card px-3 text-xs"
      >
        <option value="7">{d.period7}</option>
        <option value="30">{d.period30}</option>
        <option value="90">{d.period90}</option>
        <option value="365">{d.period365}</option>
      </NativeSelect>
    </div>
  );
}
