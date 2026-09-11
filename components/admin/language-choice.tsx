"use client";

import { usePathname, useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";

import {
  writeLocaleCookie,
  LOCALE_LABEL,
  LOCALES,
  localePath,
  negotiateLocale,
  stripLocale,
  type Locale,
} from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Le choix de langue de l'ecran Parametres — le pendant web de l'ecran
 * « Langue » de l'app mobile, avec la meme quatrieme option.
 *
 * « Automatique » n'est pas une langue : c'est **l'absence de cookie**. Tant
 * qu'il n'y en a pas, `proxy.ts` negocie `Accept-Language` a chaque requete,
 * donc la langue suit celle du navigateur ou du telephone. Choisir
 * « Automatique » supprime donc le cookie (`max-age=0`) au lieu d'en ecrire
 * un, puis renvoie vers la langue que la negociation donne a cet instant.
 *
 * Le bouton actif est determine cote client, apres montage : le serveur rend
 * la meme page pour un visiteur en « automatique » et pour un visiteur ayant
 * choisi explicitement sa langue courante — seul le cookie les distingue, et
 * le lire au rendu ferait diverger l'hydratation.
 */
export function LanguageChoice() {
  const { dict, locale: current } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  function apply(next: Locale | "auto") {
    writeLocaleCookie(next === "auto" ? null : next);

    const resolved =
      next === "auto"
        ? negotiateLocale(typeof navigator === "undefined" ? null : navigator.languages.join(","))
        : next;

    router.push(localePath(resolved, stripLocale(pathname)));
    router.refresh();
  }

  const options: Array<{ value: Locale | "auto"; label: string; hint?: string }> = [
    { value: "auto", label: dict.language.auto, hint: dict.language.autoHint },
    ...LOCALES.map((locale) => ({ value: locale, label: LOCALE_LABEL[locale] })),
  ];

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={dict.language.choose}>
      {options.map((option) => {
        const active = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={option.value === "auto" ? undefined : option.value}
            onClick={() => apply(option.value)}
            className={cn(
              "flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-start transition-colors",
              active
                ? "border-brand/50 bg-brand/5"
                : "border-border hover:border-brand/30 hover:bg-muted/40",
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              {option.hint ? (
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              ) : null}
            </span>
            {active ? <CheckIcon className="size-4 shrink-0 text-brand" /> : null}
          </button>
        );
      })}
    </div>
  );
}
