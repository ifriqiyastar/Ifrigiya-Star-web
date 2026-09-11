"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  writeLocaleCookie,
  LOCALE_LABEL,
  LOCALE_SHORT,
  LOCALES,
  localePath,
  stripLocale,
  type Locale,
} from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Le selecteur de langue.
 *
 * Il fait deux choses, et les deux comptent :
 *
 * 1. il **navigue** vers la meme page dans l'autre langue — `stripLocale` puis
 *    `localePath`, donc `/ar/contact` depuis `/contact`, et la page reste la
 *    meme plutot que de renvoyer a l'accueil ;
 * 2. il **memorise** le choix dans un cookie lu par `proxy.ts`. Sans lui, un
 *    visiteur qui choisit l'arabe puis revient sur `/` serait renvoye par la
 *    negociation `Accept-Language` vers la langue de son navigateur — son
 *    choix explicite serait perdu a chaque visite.
 *
 * Le cookie est pose ici, en clair, plutot que par une Server Action : c'est
 * une preference d'affichage sans effet de securite, et l'ecrire cote client
 * evite un aller-retour avant la navigation.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale: current, dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  function choose(next: Locale) {
    writeLocaleCookie(next);
    router.push(localePath(next, stripLocale(pathname)));
    // La langue vit dans la mise en page racine : sans rafraichissement, le
    // segment deja rendu resterait affiche dans l'ancienne langue.
    router.refresh();
  }

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="group"
      aria-label={dict.language.choose}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => choose(locale)}
            aria-current={active ? "true" : undefined}
            title={LOCALE_LABEL[locale]}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-(--site-accent) text-(--site-ink)"
                : "text-(--site-muted) hover:text-(--site-fg)",
            )}
          >
            <span aria-hidden>{LOCALE_SHORT[locale]}</span>
            <span className="sr-only">{LOCALE_LABEL[locale]}</span>
          </button>
        );
      })}
    </div>
  );
}
