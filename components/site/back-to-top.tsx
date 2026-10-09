"use client";

import * as React from "react";

/**
 * Le ballon de retour en haut de page, en bas a droite (a gauche en arabe :
 * `end-*` suit le sens de lecture).
 *
 * Trois etats, portes par `data-state` et animes en CSS seulement (bloc
 * « animations » de `globals.css`) :
 *
 * - `hidden`  : en haut de page, rien a remonter ;
 * - `visible` : il tombe, rebondit deux fois, puis flotte ;
 * - `kicked`  : au clic, il s'ecrase puis part vers le haut pendant que la
 *   page remonte. Il revient tout seul si le visiteur interrompt la montee.
 *
 * Le defilement suit le ballon : il **roule** (`--ball-spin`) et l'anneau
 * autour se remplit avec la progression dans la page. Ces deux valeurs
 * changent a chaque image, donc elles sont ecrites directement sur l'element
 * plutot que dans un etat React : un rendu par image de defilement pour une
 * decoration serait un mauvais echange. Seul le changement d'etat re-rend.
 *
 * ⚠️ La remontee est faite a la main (`requestAnimationFrame`), pas par
 * `scrollTo({ behavior: "smooth" })` : la duree et la courbe du navigateur ne
 * se reglent pas, et le ballon doit partir au rythme de la page. Chaque pas
 * passe `behavior: "instant"`, sinon le `scroll-behavior: smooth` pose sur
 * `html` lisserait chaque pas a son tour et la montee saccaderait.
 */
export function BackToTop({ label }: { label: string }) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [state, setState] = React.useState<"hidden" | "visible" | "kicked">("hidden");
  const kicked = React.useRef(false);
  const stopClimb = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, y / max) : 0;
      el.style.setProperty("--ball-offset", String(100 - progress * 100));
      el.style.setProperty("--ball-spin", `${Math.round(y * 0.3)}deg`);
      if (!kicked.current) setState(y > window.innerHeight * 0.75 ? "visible" : "hidden");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Premier calcul dans une image, pas dans le corps de l'effet : une page
    // rechargee au milieu doit afficher le ballon sans attendre un defilement.
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      stopClimb.current?.();
    };
  }, []);

  const kick = () => {
    const button = ref.current;
    // Le bouton devient inerte : le focus irait au `body`. Il passe au logo,
    // premier lien de la page, la ou le visiteur vient d'arriver.
    if (button && document.activeElement === button) {
      document.querySelector<HTMLElement>("header a")?.focus({ preventScroll: true });
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }

    kicked.current = true;
    setState("kicked");
    stopClimb.current = climbToTop(() => {
      stopClimb.current = null;
      kicked.current = false;
      setState(window.scrollY > window.innerHeight * 0.75 ? "visible" : "hidden");
    });
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={kick}
      aria-label={label}
      title={label}
      data-state={state}
      inert={state !== "visible"}
      className="site-ball group fixed end-4 bottom-5 z-40 size-16 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent) sm:end-8 sm:bottom-8 sm:size-[4.5rem]"
    >
      <span aria-hidden className="site-ball-shadow" />
      <span aria-hidden className="site-ball-float absolute inset-0">
        {/* L'anneau de progression : rempli a 100 % en bas de page. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
          <circle cx="50" cy="50" r="47" fill="rgba(0,0,0,0.72)" stroke="var(--site-line-strong)" strokeWidth="3" />
          <circle
            className="site-ball-progress"
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--site-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
          />
        </svg>

        <span className="site-ball-body absolute inset-[12%]">
          <Football />
        </span>

        {/* La fleche dit ce que fait le bouton : un ballon seul est une
            decoration, pas une commande. */}
        <span className="site-ball-arrow absolute -end-1 -top-1 flex size-6 items-center justify-center rounded-full bg-(--site-accent) text-(--site-ink) shadow-[0_0_0_3px_#000] sm:size-7">
          <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current stroke-3 sm:size-4">
            <path d="M12 19V5m-6 6 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/**
 * Remonte la page en ~0,6 a 1,4 s selon la distance, en `easeInOutCubic`.
 * La molette, le toucher ou le clavier rendent la main immediatement : on ne
 * confisque pas le defilement a quelqu'un qui veut s'arreter en chemin.
 * Renvoie de quoi interrompre la montee ; `onDone` est appele une seule fois.
 */
function climbToTop(onDone: () => void): () => void {
  const start = window.scrollY;
  const duration = Math.min(1400, Math.max(600, start * 0.3));
  const t0 = performance.now();
  let frame = 0;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("wheel", finish);
    window.removeEventListener("touchstart", finish);
    window.removeEventListener("keydown", finish);
    onDone();
  };

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    window.scrollTo({ top: start * (1 - eased), behavior: "instant" });
    if (t < 1) frame = requestAnimationFrame(step);
    else finish();
  };

  window.addEventListener("wheel", finish, { passive: true });
  window.addEventListener("touchstart", finish, { passive: true });
  window.addEventListener("keydown", finish);
  frame = requestAnimationFrame(step);
  return finish;
}

/* ------------------------------------------------------------- le ballon */

/**
 * Le ballon classique : un pentagone noir au centre, cinq autres coupes par
 * le bord, et les coutures des hexagones blancs entre eux. La geometrie est
 * calculee une fois, au chargement du module.
 *
 * Seul le motif tourne (`.site-ball-pattern`) : l'ombrage et le reflet
 * restent fixes, eclaires d'en haut a gauche, sinon le ballon tournerait
 * comme une image collee au lieu de rouler sous une lumiere.
 *
 * Les couleurs sont celles de la charte : noir, blanc et le gris #CCCCCC de
 * l'ombrage. Les identifiants SVG sont fixes : il n'y a qu'un ballon par page.
 */
type Point = readonly [number, number];

const polar = (r: number, deg: number, cx = 50, cy = 50): Point => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const points = (list: readonly Point[]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

const DIRECTIONS = [0, 1, 2, 3, 4].map((k) => -90 + 72 * k);
const CENTER_PATCH = DIRECTIONS.map((d) => polar(14, d));
const RIM_PATCHES = DIRECTIONS.map((d) => {
  const [cx, cy] = polar(42, d);
  return [0, 1, 2, 3, 4].map((j) => polar(12, d + 180 + 72 * j, cx, cy));
});
const SEAMS: readonly (readonly [Point, Point])[] = [
  // Du pentagone central vers chaque pentagone du bord…
  ...DIRECTIONS.map((_, k) => [CENTER_PATCH[k], RIM_PATCHES[k][0]] as const),
  // …et d'un pentagone du bord a son voisin : les hexagones se referment.
  ...DIRECTIONS.map((_, k) => [RIM_PATCHES[k][4], RIM_PATCHES[(k + 1) % 5][1]] as const),
];

function Football() {
  return (
    <svg viewBox="0 0 100 100" className="size-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]">
      <defs>
        <radialGradient id="site-ball-shade" cx="36%" cy="30%" r="78%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cccccc" />
        </radialGradient>
        <radialGradient id="site-ball-depth" cx="40%" cy="36%" r="70%">
          <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.38" />
        </radialGradient>
        <clipPath id="site-ball-clip">
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="46" fill="url(#site-ball-shade)" />
      <g clipPath="url(#site-ball-clip)">
        <g className="site-ball-pattern">
          {SEAMS.map(([a, b], i) => (
            <line
              key={i}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke="#000000"
              strokeOpacity="0.5"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ))}
          <polygon points={points(CENTER_PATCH)} fill="#000000" strokeLinejoin="round" />
          {RIM_PATCHES.map((patch, i) => (
            <polygon key={i} points={points(patch)} fill="#000000" />
          ))}
        </g>
        {/* Le volume : les bords s'assombrissent, le motif compris. */}
        <circle cx="50" cy="50" r="46" fill="url(#site-ball-depth)" />
      </g>
      <ellipse cx="35" cy="28" rx="13" ry="7" fill="#ffffff" opacity="0.45" transform="rotate(-32 35 28)" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#000000" strokeOpacity="0.3" strokeWidth="1" />
    </svg>
  );
}
