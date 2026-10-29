import type { SVGProps } from "react";

/**
 * Marques de demonstration pour le bandeau defilant presente au client.
 * Ce sont des noms et pictogrammes generiques, pas des partenaires reels —
 * a remplacer par les vrais logos des partenaires quand ils seront fournis.
 */

function IconNova(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z" />
    </svg>
  );
}

function IconAtlas(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3 19 L9 8 L13 14.5 L16 9.5 L21 19 Z" />
    </svg>
  );
}

function IconVertex(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 15 L12 7 L20 15" />
      <path d="M4 20.5 L12 12.5 L20 20.5" />
    </svg>
  );
}

function IconOrbit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-24 12 12)" stroke="currentColor" strokeWidth={2} />
      <circle cx="20" cy="7" r="1.7" fill="currentColor" />
    </svg>
  );
}

function IconApex(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 3.5 L21 20 L3 20 Z" />
    </svg>
  );
}

function IconZenith(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
      <path d="M12 2.5 V5.5 M12 18.5 V21.5 M2.5 12 H5.5 M18.5 12 H21.5 M5.1 5.1 L7.2 7.2 M16.8 16.8 L18.9 18.9 M5.1 18.9 L7.2 16.8 M16.8 7.2 L18.9 5.1" />
    </svg>
  );
}

/**
 * Le nombre de copies de la bande dans le ruban defilant.
 *
 * ⚠️ IL VIT ICI, A COTE DE LA LISTE, ET IL EST LU PAR LE CSS. Le ruban
 * n'en portait que deux, et l'animation les faisait glisser de `-50%` : la
 * distance tombait juste, mais la bande entiere ne mesurait alors qu'environ
 * deux fois sa propre largeur — soit a peine 2 000 px. Des que la fenetre etait
 * plus large que le ruban moins une copie, la fin de la bande entrait dans le
 * champ et laissait du vide a droite avant de se reinitialiser d'un coup. C'est
 * le « glitch » de fin : il n'y avait plus rien a afficher.
 *
 * Pour qu'un defilement soit continu, la bande doit toujours mesurer au moins
 * la largeur de la fenetre plus une copie. Six copies couvrent environ 6 000 px,
 * donc tous les ecrans jusqu'au 4K. La valeur est passee au CSS en variable
 * (`--site-marquee-copies`) par la page qui rend le ruban : la distance de
 * translation en est **derivee** (`-100% / copies`), elle ne peut donc plus
 * diverger du nombre de copies rendues — c'est ce couplage-la qui manquait.
 */
export const PARTNER_MARQUEE_COPIES = 6;

export const PLACEHOLDER_PARTNER_LOGOS = [
  { name: "Nova", Icon: IconNova },
  { name: "Atlas", Icon: IconAtlas },
  { name: "Vertex", Icon: IconVertex },
  { name: "Orbit", Icon: IconOrbit },
  { name: "Apex", Icon: IconApex },
  { name: "Zenith", Icon: IconZenith },
];
