"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SLIDES = [
  {
    tag: "Scout Days",
    title: "Ton talent mérite le terrain.",
    description:
      "Des journées de détection pour montrer ce que tu sais faire. Découvre le parcours, les critères et les étapes pour te faire remarquer.",
    action: "Découvrir le parcours",
    href: "#comment",
    image: "/videos/football-hero-cover.webp",
  },
  {
    tag: "À toi de jouer",
    title: "Fais parler ton football.",
    description:
      "Tes plus belles actions, ton parcours, ta progression. Rassemble tes vidéos et tes photos sur un profil visible par les professionnels.",
    action: "Explorer l’application",
    href: "#fonctionnalites",
    image: "/images/carousel-training.jpg",
  },
  {
    tag: "Ifriqiya Star",
    title: "Le football nous fait grandir.",
    description:
      "L’excellence, la discipline et l’esprit d’équipe nous rassemblent. Découvre les valeurs qui accompagnent chaque talent dans son ascension.",
    action: "Découvrir nos valeurs",
    href: "#valeurs",
    image: "/images/carousel-football.jpg",
  },
];

export function HighlightsCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const rotating = visible && !paused && !hovered && !focused && !reducedMotion;

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({ left: slide.offsetLeft, behavior: reducedMotion ? "instant" : "smooth" });
  }, [reducedMotion]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);

    let intersecting = false;
    const syncVisibility = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      syncVisibility();
    }, { threshold: 0.35 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => goTo((active + 1) % SLIDES.length), 10000);
    return () => window.clearTimeout(timer);
  }, [active, goTo, rotating]);

  return (
    <section
      ref={sectionRef}
      aria-label="À découvrir avec Ifriqiya Star"
      aria-roledescription="carrousel"
      className="mx-auto max-w-7xl px-5 pt-5 pb-12 sm:px-8 sm:pb-16 [&_button]:cursor-pointer [&_button:disabled]:cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#101010]">
        <div
          ref={trackRef}
          id="highlights-track"
          tabIndex={0}
          aria-label="Diapositives — utilisez les flèches pour naviguer"
          className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--site-accent) [&::-webkit-scrollbar]:hidden"
          onPointerDown={() => setPaused(true)}
          onKeyDown={(event) => {
            let target: number;
            if (event.key === "ArrowRight") target = (active + 1) % SLIDES.length;
            else if (event.key === "ArrowLeft") target = (active + SLIDES.length - 1) % SLIDES.length;
            else if (event.key === "Home") target = 0;
            else if (event.key === "End") target = SLIDES.length - 1;
            else return;
            event.preventDefault();
            setPaused(true);
            goTo(target);
          }}
          onScroll={() => {
            const track = trackRef.current;
            if (!track) return;
            const distances = Array.from(track.children, (slide) =>
              Math.abs((slide as HTMLElement).offsetLeft - track.scrollLeft));
            setActive(distances.indexOf(Math.min(...distances)));
          }}
        >
          {SLIDES.map((slide, index) => (
            <article
              key={slide.tag}
              role="group"
              aria-roledescription="diapositive"
              aria-label={`${index + 1} sur ${SLIDES.length} : ${slide.tag}`}
              className="relative isolate flex min-h-[420px] w-full shrink-0 snap-start flex-col items-start overflow-hidden border-r border-white/20 px-6 py-9 last:border-r-0 sm:min-h-[450px] sm:px-12 sm:py-12 lg:w-[70%] lg:px-14 lg:last:w-full"
            >
              <Image src={slide.image} alt="" fill sizes="(min-width: 1024px) 850px, 100vw" className="-z-20 object-cover grayscale" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.5),rgba(0,0,0,0.92)),linear-gradient(90deg,rgba(0,0,0,0.45),transparent)]" />
              <span className="rounded-full bg-(--site-accent) px-4 py-2 text-[0.625rem] font-extrabold tracking-wider text-black uppercase">{slide.tag}</span>
              <h2 className="font-heading mt-6 max-w-xl text-3xl leading-[1.05] font-extrabold tracking-tight text-white uppercase sm:text-4xl lg:text-5xl">{slide.title}</h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/70 sm:text-base">{slide.description}</p>
              <a
                href={slide.href}
                tabIndex={active === index ? 0 : -1}
                className="mt-7 mb-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-(--site-accent) px-5 py-3 text-sm font-bold text-black shadow-[0_0_32px_-8px_var(--site-accent)] transition-shadow hover:shadow-[0_0_40px_-4px_var(--site-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-7"
              >
                {slide.action}<ArrowRight className="size-4 shrink-0" aria-hidden />
              </a>
              <span aria-hidden className="mt-auto flex size-10 items-center justify-center rounded-full border border-(--site-accent) pt-px text-xs font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
            </article>
          ))}
        </div>
        <div className="mx-4 grid grid-cols-[1fr_auto_1fr] items-center border-t border-white/20 py-3 sm:mx-8">
          <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Activer le défilement automatique" : "Mettre en pause le défilement automatique"} aria-pressed={paused} disabled={reducedMotion} className="flex size-10 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-(--site-accent)">
            {paused || reducedMotion ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          </button>
          <div className="flex items-center" aria-label="Choisir une diapositive">
            {SLIDES.map((slide, index) => (
              <button key={slide.tag} type="button" aria-label={`Afficher : ${slide.tag}`} aria-current={active === index ? "true" : undefined} aria-controls="highlights-track" onClick={() => { setPaused(true); goTo(index); }} className="flex size-10 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-(--site-accent)">
                <span className={`h-2 rounded-full transition-all motion-reduce:transition-none ${active === index ? "w-6 bg-(--site-accent)" : "w-2 bg-white/25"}`} />
              </button>
            ))}
          </div>
          <div className="flex justify-self-end">
            {[{ label: "Diapositive précédente", step: -1, Icon: ArrowLeft }, { label: "Diapositive suivante", step: 1, Icon: ArrowRight }].map(({ label, step, Icon }) => (
              <button key={step} type="button" aria-label={label} aria-controls="highlights-track" onClick={() => { setPaused(true); goTo((active + step + SLIDES.length) % SLIDES.length); }} className="flex size-10 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-(--site-accent) focus-visible:outline-2 focus-visible:outline-(--site-accent)"><Icon className="size-4" aria-hidden /></button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
