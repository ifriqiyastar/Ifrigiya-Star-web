"use client";

import { useEffect, useRef, useState } from "react";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection;
    // Preserve the original quality, including on high-density mobile screens.
    const source = "/videos/football-hero-4k.mp4";
    let visible = false;
    let sourceAttached = false;
    let playPending = false;
    let autoplayBlocked = false;
    let disposed = false;

    function shouldPlay() {
      return !disposed && visible && !document.hidden && !motion.matches && !connection?.saveData;
    }

    function syncPlayback() {
      if (!shouldPlay()) {
        video!.pause();
        return;
      }
      if (!sourceAttached) {
        sourceAttached = true;
        video!.src = source;
        video!.preload = "auto";
        video!.load();
        return;
      }
      if (!video!.paused || playPending || autoplayBlocked) return;

      // Build a small buffer before starting, rather than stuttering on the
      // first downloaded frame. The lightweight poster stays visible meanwhile.
      let bufferedAhead = 0;
      for (let index = 0; index < video!.buffered.length; index++) {
        if (video!.buffered.start(index) <= video!.currentTime && video!.buffered.end(index) > video!.currentTime) {
          bufferedAhead = video!.buffered.end(index) - video!.currentTime;
          break;
        }
      }
      const remaining = Number.isFinite(video!.duration)
        ? video!.duration - video!.currentTime
        : 2;
      if (video!.readyState < 3 || bufferedAhead < Math.min(2, remaining)) return;

      playPending = true;
      void video!.play().catch((error: unknown) => {
        // Browser autoplay restrictions leave the poster visible.
        if (error instanceof DOMException && error.name === "NotAllowedError") autoplayBlocked = true;
      }).finally(() => {
        playPending = false;
        if (!shouldPlay()) video!.pause();
      });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      },
      { threshold: 0.2 },
    );
    const loadingEvents = ["loadeddata", "canplay", "canplaythrough", "progress"];
    loadingEvents.forEach((event) => video.addEventListener(event, syncPlayback));
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    motion.addEventListener("change", syncPlayback);
    return () => {
      disposed = true;
      observer.disconnect();
      loadingEvents.forEach((event) => video.removeEventListener(event, syncPlayback));
      document.removeEventListener("visibilitychange", syncPlayback);
      motion.removeEventListener("change", syncPlayback);
      video.pause();
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <video
          ref={videoRef}
          id="hero-football-video"
          width={3840}
          height={2160}
          poster="/videos/football-hero-cover.webp"
          preload="none"
          muted
          loop
          playsInline
          tabIndex={-1}
          className="absolute inset-0 size-full object-cover object-center"
          onError={() => setFailed(true)}
        >
          Votre navigateur ne prend pas en charge cette vidéo.
        </video>
        <div className="absolute inset-0 bg-black/45 sm:bg-black/20" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.65)_40%,rgba(0,0,0,0.1)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#000_0%,rgba(0,0,0,0)_30%,rgba(0,0,0,0)_80%,rgba(0,0,0,0.3)_100%)]" />
      </div>

      {failed && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-7xl items-center justify-end gap-3 px-5 sm:bottom-8 sm:px-8">
          <p role="status" className="rounded-full bg-black/60 px-4 py-2 text-sm text-(--site-muted)">
            La vidéo est momentanément indisponible.
          </p>
        </div>
      )}
    </>
  );
}
