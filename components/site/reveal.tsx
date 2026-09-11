"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Apparition au defilement.
 *
 * Le contenu monte et s'opacifie quand il entre dans la fenetre, une seule
 * fois : une section qui rejouerait son animation a chaque passage devient
 * fatigante des le deuxieme scroll.
 *
 * Trois garde-fous, parce qu'une animation ne doit jamais couter le contenu :
 *
 * - `prefers-reduced-motion` neutralise l'effet dans `globals.css` — le bloc
 *   `.site-reveal` y rend tout visible sans transition.
 * - sans JavaScript du tout, le `<noscript>` de `app/page.tsx` reaffiche
 *   l'ensemble : rien de ce qui porte du texte ne depend d'un script.
 *
 * Pas de repli pour un navigateur sans `IntersectionObserver` : Tailwind v4
 * exige deja Safari 16.4 / Chrome 111, et l'API est universelle depuis 2019.
 * La branche serait morte, et elle ne pourrait de toute facon pas etre testee.
 *
 * L'effet est volontairement court (500 ms) et unique sur toute la page :
 * la charte demande de la sobriete, et un site ou chaque bloc arrive
 * differemment se lit comme une demonstration technique.
 */
type RevealProps = {
  children: ReactNode;
  /** Decalage en ms, pour faire arriver une liste element par element. */
  delay?: number;
  /** Direction d'arrivee. Par defaut le contenu monte. */
  variant?: "up" | "left" | "right" | "zoom";
  className?: string;
  as?: ElementType;
};

export function Reveal({
  children,
  delay = 0,
  variant = "up",
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          // Une seule fois : on cesse d'observer des que c'est apparu.
          observer.disconnect();
        }
      },
      // Le bloc doit etre franchement entre dans l'ecran avant de s'animer,
      // sinon l'effet se joue hors champ et l'utilisateur ne voit rien.
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-variant={variant}
      className={cn("site-reveal", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
