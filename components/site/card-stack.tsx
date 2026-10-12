"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Pile de cartes au defilement : chaque enfant direct est colle en haut de
 * l'ecran (`.site-stack-item`, `position: sticky`) et la carte suivante
 * vient glisser par-dessus.
 *
 * Le collage est du CSS pur ; ce composant ne fait qu'une chose : dire a
 * chaque carte **a quel point elle est recouverte**, dans `--p`, pour
 * qu'elle recule et s'assombrisse sous celle qui arrive. `--p` vaut la
 * somme des recouvrements par toutes les cartes suivantes (0 = libre,
 * 1 = entierement couverte par la suivante, 2 = par les deux suivantes…),
 * si bien que les cartes du fond continuent de reculer.
 *
 * Pourquoi du JavaScript et pas `animation-timeline: view()` comme le reste
 * de la page : une carte collee ne bouge plus dans la fenetre, donc sa
 * propre timeline `view()` cesse d'avancer exactement pendant qu'on la
 * recouvre. C'est la position de la carte **suivante** qui compte, et
 * aucune timeline CSS ne lit celle d'un voisin. En prime, Firefox et Safari
 * ont l'effet aussi.
 *
 * Seules des variables CSS sont ecrites, une fois par image (`rAF`), et la
 * feuille de style decide quoi en faire — y compris rien du tout en
 * mouvement reduit.
 */
export function CardStack({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const items = Array.from(list.children) as HTMLElement[];
      const coverage = items.map((item, i) => {
        if (i === 0) return 0;
        // Recouvrement de la carte precedente par celle-ci : 0 tant qu'elle
        // est a une hauteur de carte de son point de collage, 1 une fois
        // collee.
        const previous = items[i - 1];
        const style = getComputedStyle(item);
        // Ecran trop bas : la feuille de style a rendu la liste ordinaire, et
        // une carte qui ne se fait pas recouvrir n'a pas a s'assombrir.
        if (style.position !== "sticky") return 0;
        const stickTop = parseFloat(style.top) || 0;
        const distance = item.getBoundingClientRect().top - stickTop;
        const height = previous.offsetHeight || 1;
        return Math.min(1, Math.max(0, 1 - distance / height));
      });
      items.forEach((item, i) => {
        let depth = 0;
        for (let j = i + 1; j < items.length; j++) depth += coverage[j];
        item.style.setProperty("--p", depth.toFixed(3));
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={cn("site-stack", className)}>
      {children}
    </div>
  );
}
