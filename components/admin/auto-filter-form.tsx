"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Formulaire de filtres qui s'applique tout seul.
 *
 * C'etait un `<form method="get">` avec un bouton « Appliquer » : changer un
 * type ou taper un nom ne faisait rien tant qu'on n'avait pas clique, et le
 * clic rechargeait toute la page. L'etat vit toujours dans l'URL — la page
 * reste un Server Component qui refait sa requete — mais la navigation part
 * d'elle-meme :
 *
 *  * une liste change → tout de suite ;
 *  * le champ de recherche → 300 ms apres la derniere frappe, pour ne pas
 *    lancer une requete par caractere ;
 *  * Entree reste possible, et part sans attendre.
 *
 * `router.replace` plutot qu'une soumission native : la page n'est pas
 * rechargee, le champ garde le focus pendant la frappe, et chaque lettre ne
 * laisse pas une entree dans l'historique. Les valeurs vides sont retirees de
 * l'adresse, et `page` aussi : un nouveau filtre repart de la premiere page.
 */
export function AutoFilterForm({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  // Les champs sont non controles : apres « Reinitialiser » ou un retour
  // arriere, l'adresse change mais le texte tape et la liste choisie
  // restaient affiches. On les realigne sur l'URL — sauf le champ ou l'on est
  // en train d'ecrire, que la reponse a sa propre frappe ne doit pas ecraser.
  const searchParams = useSearchParams();
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) continue;
      if (!element.name || element === document.activeElement) continue;
      const value = searchParams.get(element.name) ?? "";
      if (element.value !== value) element.value = value;
    }
  }, [searchParams]);

  const apply = React.useCallback((submitter?: HTMLElement | null) => {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    // Le bouton qui a soumis compte : un « effacer » est un bouton
    // `name="q" value=""`, et sa valeur vide doit l'emporter sur le texte du
    // champ qui le precede. D'ou `delete` sur une valeur vide plutot que de
    // l'ignorer.
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form, submitter ?? undefined)) {
      if (typeof value !== "string") continue;
      if (value.trim()) query.set(key, value.trim());
      else query.delete(key);
    }
    const search = query.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  }, [pathname, router]);

  return (
    <form
      ref={formRef}
      role="search"
      aria-busy={pending}
      data-pending={pending}
      className={cn("group/filters", className)}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.nativeEvent.submitter);
      }}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio") {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(), 300);
        } else {
          apply();
        }
      }}
    >
      {children}
    </form>
  );
}

/**
 * La loupe du champ de recherche, remplacee par un spinner pendant que la
 * liste se recharge : c'est la ou le regard est deja. Lit l'etat du
 * formulaire par `group-data-[pending]`, sans contexte React.
 */
export function FilterSearchIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
      <span className="contents group-data-[pending=true]/filters:hidden">{icon}</span>
      <Loader2Icon
        aria-hidden
        className="hidden size-4 animate-spin text-brand group-data-[pending=true]/filters:block"
      />
    </span>
  );
}
