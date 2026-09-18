"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, GlobeIcon, Loader2Icon } from "lucide-react";

import {
  LOCALE_LABEL,
  LOCALE_SHORT,
  LOCALES,
  localePath,
  stripLocale,
  writeLocaleCookie,
  type Locale,
} from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Le selecteur de langue de l'entete publique.
 *
 * ⚠️ **Il n'utilise pas le `DropdownMenu` de `components/ui`**, et c'est la
 * meme raison qui fait que le tiroir de `site-nav.tsx` n'utilise pas `Sheet` :
 * ces primitives sont **portees dans `document.body`**, alors que les
 * variables `--site-*` sont declarees sur `.site-shell`. Un menu porte
 * sortirait de la portee des tokens et se rendrait sans couleur de marque.
 * Ce menu-ci reste donc un enfant du bouton, en `position: absolute`.
 *
 * Choix d'interface, apres avoir essaye la rangee de trois pastilles :
 *
 * - **un seul declencheur au lieu de trois boutons.** Choisir sa langue est
 *   un geste qu'on fait une fois ; trois boutons permanents lui donnaient
 *   autant de place qu'a la navigation principale, et autant de poids visuel
 *   que le bouton de telechargement ;
 * - **un globe.** Rien, dans un « FR » sur fond lime, ne dit qu'il s'agit
 *   d'une langue — cela pouvait aussi bien etre un filtre ou un onglet actif.
 *   Le globe est la convention que l'oeil cherche ;
 * - **les noms dans leur propre ecriture** dans le menu. Un arabophone
 *   reconnait العربية instantanement, « ع » ne lui dit rien ;
 * - **44 px de cible tactile** sur le declencheur, contre une vingtaine de
 *   pixels pour les anciennes pastilles ;
 * - et il **tient a trois langues comme a six** : la rangee, non.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale: current, dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Changer de langue rejoue la mise en page racine (`router.refresh()`) : le
  // globe se change en sablier le temps que la page se rende dans l'autre
  // langue, plutot que de laisser le menu se refermer sans rien dire.
  const [pending, startTransition] = useTransition();

  // Fermeture au clic exterieur et a Echap. `pointerdown` plutot que `click` :
  // un clic sur un lien de l'entete doit fermer le menu avant que la
  // navigation ne parte, sinon il reste ouvert sur la page suivante.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Le focus revient au declencheur : sans cela il retomberait en haut du
      // document et l'utilisateur au clavier perdrait sa place.
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // A l'ouverture, le focus se pose sur la langue courante — l'endroit d'ou
  // l'on veut naviguer, plutot que sur la premiere entree de la liste.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[LOCALES.indexOf(current)]?.focus();
  }, [open, current]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === current) return;
    startTransition(() => {
      writeLocaleCookie(next);
      router.push(localePath(next, stripLocale(pathname)));
      // La langue vit dans la mise en page racine : sans rafraichissement, le
      // segment deja rendu resterait affiche dans l'ancienne langue.
      router.refresh();
    });
  }

  /** Deplacement au clavier dans le menu, comme un vrai menu ARIA. */
  function onMenuKeyDown(event: React.KeyboardEvent, index: number) {
    const last = LOCALES.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    itemRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${dict.language.choose} — ${LOCALE_LABEL[current]}`}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-full border ps-3 pe-2.5 transition-colors",
          "text-[var(--site-muted)] hover:text-[var(--site-fg)]",
          "disabled:pointer-events-none disabled:opacity-60",
          open
            ? "border-[var(--site-accent)] text-[var(--site-fg)]"
            : "border-[var(--site-line-strong)] hover:border-[var(--site-accent)]",
        )}
      >
        {pending ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <GlobeIcon className="size-4 shrink-0" aria-hidden />
        )}
        <span className="text-xs font-semibold tracking-wide">{LOCALE_SHORT[current]}</span>
        <ChevronDownIcon
          className={cn("size-3 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {/* Toujours monte : le menu s'efface plutot que de disparaitre, au meme
          rythme que le chevron. `inert` le retire du parcours clavier tant
          qu'il est ferme, donc « toujours monte » ne veut pas dire
          « toujours atteignable ». */}
      <div
        role="menu"
        aria-label={dict.language.choose}
        inert={!open}
        className={cn(
          "absolute end-0 top-full z-10 mt-2 w-48 origin-top overflow-hidden rounded-2xl",
          "border border-[var(--site-line-strong)] bg-[var(--site-bg)] p-1.5 shadow-2xl",
          "transition duration-150 ease-out motion-reduce:transition-none",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {LOCALES.map((locale, index) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              tabIndex={open ? 0 : -1}
              lang={locale}
              onClick={() => choose(locale)}
              onKeyDown={(event) => onMenuKeyDown(event, index)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                active
                  ? "text-[var(--site-accent)]"
                  : "text-[var(--site-fg)] hover:bg-white/5",
              )}
            >
              <span className="flex flex-col">
                {/* Le nom de la langue dans sa propre ecriture : c'est lui
                    qu'on reconnait, pas le code. */}
                <span className="text-sm font-medium">{LOCALE_LABEL[locale]}</span>
                <span className="text-[0.6875rem] tracking-wide text-[var(--site-muted)]">
                  {LOCALE_SHORT[locale]}
                </span>
              </span>
              {active ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
