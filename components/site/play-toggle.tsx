"use client";

import { PauseIcon, PlayIcon } from "lucide-react";

type PlayToggleProps = {
  /** L'etat reel du lecteur, pas l'intention : c'est lui qui pilote l'icone. */
  playing: boolean;
  /** Le libelle visible — « Lire » ou « Pause ». */
  label: string;
  /** Ce que lit un lecteur d'ecran, qui a besoin de savoir *quelle* video. */
  ariaLabel: string;
  onToggle: () => void;
  /**
   * Le placement appartient a l'appelant. Le bouton ne porte volontairement
   * pas `relative` : entre deux utilitaires de positionnement, Tailwind
   * tranche selon l'ordre de sa feuille et non selon l'ordre de l'attribut —
   * `relative` gagnerait, et l'`absolute` passe ici resterait sans effet.
   */
  className?: string;
};

/**
 * Le bouton lecture/pause des apercus video, repris du « btn-7 » d'Amicro
 * (https://amicro.vercel.app/buttons/btn-7) : une pilule dont l'icone se
 * metamorphose — l'ancienne se retire en retrecissant, la nouvelle arrive en
 * grossissant, avec un leger depassement — pendant que le rembourrage
 * s'ecarte et que le bouton grandit d'un pour cent.
 *
 * Deux ecarts avec l'original, tous les deux volontaires :
 *
 * 1. **La permutation suit la video, pas la souris.** Amicro fait basculer
 *    l'icone au survol, parce que sa page est une vitrine et que le bouton ne
 *    commande rien. Ici il commande la lecture : afficher « pause » parce que
 *    le curseur passe dessus mentirait sur l'etat du lecteur, et ne dirait
 *    rien du tout sur un telephone, ou il n'y a pas de survol.
 * 2. **C'est du CSS.** L'original est ecrit avec Framer Motion ; le site
 *    vitrine n'embarque aucun moteur d'animation (cf. le bloc « animations »
 *    de `globals.css`), et un ressort sur une icone de 16 px ne justifie pas
 *    d'en ajouter un. La courbe `cubic-bezier(0.34, 1.56, 0.64, 1)` redonne
 *    le depassement du ressort.
 *
 * La couleur de l'icone active est l'accent de la charte et non le vert de
 * l'original : la palette du site vitrine n'a que quatre couleurs.
 */
export function PlayToggle({ playing, label, ariaLabel, onToggle, className = "" }: PlayToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-pressed={playing}
      data-playing={playing}
      className={`group/play flex h-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/65 px-6 text-white backdrop-blur-sm transition-[background-color,padding,transform] duration-200 ease-out hover:bg-black/85 hover:px-7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent) active:scale-95 motion-safe:hover:scale-[1.02] motion-reduce:transition-none ${className}`}
    >
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <PlayIcon
          aria-hidden
          className="absolute size-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[playing=true]/play:scale-50 group-data-[playing=true]/play:opacity-0 motion-reduce:transition-none"
        />
        <PauseIcon
          aria-hidden
          className="absolute size-4 scale-50 text-(--site-accent) opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[playing=true]/play:scale-100 group-data-[playing=true]/play:opacity-100 motion-reduce:transition-none"
        />
      </span>
      <span className="ms-2.5 text-[13px] font-medium tracking-tight whitespace-nowrap">{label}</span>
    </button>
  );
}
