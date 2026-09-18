"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, GlobeIcon, Loader2Icon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_LOCALES,
  LOCALE_LABEL,
  LOCALE_SHORT,
  localePath,
  stripLocale,
  writeLocaleCookie,
  type AdminLocale,
} from "@/lib/i18n/config";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

/**
 * Le selecteur de langue du bandeau d'administration, a cote de la cloche.
 *
 * C'est le pendant de celui de l'entete publique
 * (`components/language-switcher.tsx`) et il en reprend les partis pris :
 * **un seul declencheur** plutot qu'une rangee de pastilles, **un globe**
 * parce que rien dans un « FR » ne dit qu'il s'agit d'une langue, et les noms
 * **dans leur propre ecriture** dans le menu.
 *
 * Deux differences, toutes deux dictees par l'endroit :
 *
 * - **deux langues seulement.** Le back-office ne parle pas arabe
 *   (cf. `ADMIN_LOCALES`), et `proxy.ts` detourne deja `/ar/admin`. Le menu
 *   ne propose donc que ce que l'administration sait reellement rendre ;
 * - **il utilise `DropdownMenu`**, la ou le selecteur public s'en interdit.
 *   La raison qui l'interdit la-bas — les primitives sont portees dans
 *   `document.body`, hors de portee des variables `--site-*` declarees sur
 *   `.site-shell` — ne s'applique pas ici : le bandeau n'utilise que les
 *   tokens globaux du theme sombre, exactement comme le menu de la cloche
 *   juste a cote, qui est deja porte.
 *
 * « Automatique » n'est volontairement pas propose ici : c'est un reglage,
 * pas un geste courant, et il vit dans l'ecran Parametres a cote de ce qu'il
 * signifie. Choisir une langue depuis le bandeau ecrit donc une preference
 * explicite — c'est bien ce que l'on veut d'un selecteur qu'on ouvre pour
 * changer de langue maintenant.
 */
export function LanguageMenu() {
  const { locale, dict } = useAdminI18n();
  const pathname = usePathname();
  const router = useRouter();
  // Changer de langue rejoue toute la mise en page (`router.refresh()`), donc
  // les donnees de la page courante sont relues avant que quoi que ce soit ne
  // change a l'ecran — visible, pas instantane. `isPending` habille cette
  // attente au lieu de laisser le menu simplement se refermer sur du vieux
  // contenu.
  const [pending, startTransition] = useTransition();

  function choose(next: AdminLocale) {
    if (next === locale) return;
    startTransition(() => {
      writeLocaleCookie(next);
      // Le cookie seul ne suffit pas : l'adresse porte la langue, et c'est elle
      // qui gagne sur le cookie dans `proxy.ts` — sans quoi un lien partage
      // s'ouvrirait dans la langue du destinataire.
      router.push(localePath(next, stripLocale(pathname)));
      // La langue vit dans la mise en page racine : sans rafraichissement, le
      // segment deja rendu resterait affiche dans l'ancienne langue.
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={`${dict.language.choose} — ${LOCALE_LABEL[locale]}`}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5",
          "text-muted-foreground transition-colors hover:text-foreground",
          "hover:border-brand/50 aria-expanded:border-brand/50 aria-expanded:text-foreground",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {pending ? (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <GlobeIcon className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="text-[0.6875rem] font-semibold tracking-wide">
          {LOCALE_SHORT[locale]}
        </span>
        <ChevronDownIcon className="size-3 shrink-0" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="micro-label text-muted-foreground">
            {dict.language.menuLabel}
          </DropdownMenuLabel>
          {ADMIN_LOCALES.map((value) => {
            const active = value === locale;
            return (
              <DropdownMenuItem
                key={value}
                lang={value}
                onClick={() => choose(value)}
                className={cn("gap-3", active && "text-brand")}
              >
                <span className="flex min-w-0 flex-col">
                  {/* Le nom de la langue dans sa propre ecriture : c'est lui
                      qu'on reconnait, pas le code. */}
                  <span className="text-sm font-medium">{LOCALE_LABEL[value]}</span>
                  <span className="text-[0.625rem] tracking-wide text-muted-foreground">
                    {LOCALE_SHORT[value]}
                  </span>
                </span>
                {active ? <CheckIcon className="ml-auto size-4 shrink-0" aria-hidden /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
