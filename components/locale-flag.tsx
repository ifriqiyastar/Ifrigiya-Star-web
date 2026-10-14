import { useId } from "react";

import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Le drapeau a cote de chaque langue du selecteur (demande du client,
 * oct. 2026) : la France pour le francais, le Royaume-Uni pour l'anglais, la
 * Tunisie pour l'arabe.
 *
 * En SVG et non en emoji : Windows n'a pas d'emojis drapeaux et affiche a la
 * place les deux lettres du pays (« FR »), qui doubleraient le code juste a
 * cote. Les couleurs sont celles des drapeaux — hors charte, forcement.
 *
 * Purement decoratif (`aria-hidden`) : le nom de la langue est deja lu.
 * `useId` parce que le meme drapeau est rendu deux fois sur la page (le
 * declencheur et le menu) et que deux `clipPath` de meme `id` se
 * confondraient.
 */
export function LocaleFlag({ locale, className }: { locale: Locale; className?: string }) {
  const id = useId();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-3.5 w-[1.3125rem] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-white/15",
        className,
      )}
    >
      {locale === "fr" ? <France /> : locale === "en" ? <UnitedKingdom id={id} /> : <Tunisia />}
    </span>
  );
}

function France() {
  return (
    <svg viewBox="0 0 3 2" className="size-full" preserveAspectRatio="none">
      <rect width="1" height="2" fill="#000091" />
      <rect x="1" width="1" height="2" fill="#ffffff" />
      <rect x="2" width="1" height="2" fill="#e1000f" />
    </svg>
  );
}

/** L'Union Jack (2:1), recadre au centre dans la meme case 3:2 que les autres. */
function UnitedKingdom({ id }: { id: string }) {
  const diagonals = `${id}-diagonals`;
  return (
    <svg viewBox="0 0 60 30" className="size-full" preserveAspectRatio="xMidYMid slice">
      <clipPath id={diagonals}>
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#ffffff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${diagonals})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#ffffff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}

function Tunisia() {
  return (
    <svg viewBox="0 0 1200 800" className="size-full">
      <rect width="1200" height="800" fill="#e70013" />
      <circle cx="600" cy="400" r="200" fill="#ffffff" />
      <circle cx="600" cy="400" r="150" fill="#e70013" />
      <circle cx="640" cy="400" r="120" fill="#ffffff" />
      <path d="M545 400l144.72-47.02-89.44 123.1V323.92l89.44 123.1z" fill="#e70013" />
    </svg>
  );
}
