"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { StarScene } from "@/components/site/star-scene";

export function HeroStar() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StarScene | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let generation = 0;
    let unmounted = false;

    async function start() {
      const current = ++generation;
      if (motion.matches) return;
      try {
        const { mountStarScene } = await import("@/components/site/star-scene");
        if (unmounted || current !== generation || motion.matches) return;
        sceneRef.current = mountStarScene(
          host!,
          () => setReady(true),
          () => setReady(false),
        );
      } catch {
        // The Blender poster stays visible if WebGL or the scene cannot load.
        if (!unmounted && current === generation) setReady(false);
      }
    }

    function motionChanged() {
      generation++;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setReady(false);
      setPaused(false);
      void start();
    }

    void start();
    motion.addEventListener("change", motionChanged);
    return () => {
      unmounted = true;
      generation++;
      motion.removeEventListener("change", motionChanged);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <div className="site-star relative isolate mx-auto aspect-square w-full max-w-[580px]">
      <div className="site-star-halo" aria-hidden="true" />
      <div className="site-star-orbit" aria-hidden="true" />
      <div className="pointer-events-none absolute top-3 left-4 flex items-center gap-2.5 text-[9px] font-medium tracking-[0.25em] text-(--site-muted)/65 uppercase sm:top-5 sm:left-6 sm:text-[10px]" aria-hidden="true">
        <span className="size-1 rounded-full bg-(--site-accent)" />
        Les étoiles de demain
      </div>

      <Image
        src="/models/ifriqiya-star-poster.png"
        alt="Étoile sculptée en chrome sombre, aux reflets vert lime."
        width={960}
        height={960}
        loading="eager"
        sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 580px, 46vw"
        className={`pointer-events-none absolute inset-0 size-full object-contain transition-opacity duration-500 motion-reduce:transition-none ${ready ? "opacity-0" : "opacity-100"}`}
      />
      <div
        ref={hostRef}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none [&_canvas]:block [&_canvas]:size-full ${ready ? "opacity-100" : "opacity-0"}`}
      />

      <div className="absolute right-4 bottom-2 left-4 flex min-h-9 items-center justify-between border-t border-(--site-line) pt-3 sm:right-6 sm:left-6">
        <span className="text-[9px] font-medium tracking-[0.22em] text-(--site-muted)/55 uppercase sm:text-[10px]">
          Ifriqiya Soccer Star · Ascension
        </span>
        {ready && (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Reprendre l'animation de l'étoile" : "Mettre en pause l'animation de l'étoile"}
            aria-pressed={paused}
            className="ml-2 flex size-9 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) bg-black/30 text-(--site-muted) transition-colors hover:border-(--site-accent)/60 hover:text-(--site-accent) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)"
          >
            {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}
