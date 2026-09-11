"use client";

// @refresh reset
// Media observers and in-flight play promises must not reuse pre-edit refs.

import { useEffect, useRef, useState } from "react";
import { PlayIcon, Volume2Icon, VolumeXIcon } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";

type ScoutDaysVideoPlayerProps = {
  id: string;
  src: string;
  poster: string;
  position: string;
};

function nextSoundRequest(ref: { current: number }) {
  // Older development sessions may still contain a non-numeric ref value.
  const next = typeof ref.current === "number" && Number.isFinite(ref.current)
    ? ref.current + 1
    : 1;
  ref.current = next;
  return next;
}

export function ScoutDaysVideoPlayer({ id, src, poster, position }: ScoutDaysVideoPlayerProps) {
  const { dict } = useI18n();
  const t = dict.scoutVideos;
  const videoRef = useRef<HTMLVideoElement>(null);
  const visibleRef = useRef(false);
  const soundRequestRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playbackNotice, setPlaybackNotice] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const cancelSoundRequest = () => { nextSoundRequest(soundRequestRef); };
    let disposed = false;
    let sourceAttached = false;

    function syncPlayback() {
      if (disposed) return;
      cancelSoundRequest();
      video!.muted = true;
      if (!visibleRef.current || document.hidden) {
        video!.pause();
        return;
      }
      if (!sourceAttached) {
        video!.src = src;
        sourceAttached = true;
      }
      void video!.play().catch(() => {
        // The play button remains available if autoplay is denied.
      });
    }

    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      syncPlayback();
    }, { threshold: [0, 0.35] });
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      disposed = true;
      visibleRef.current = false;
      cancelSoundRequest();
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.muted = true;
      video.pause();
    };
  }, [src]);

  function muteVideo() {
    nextSoundRequest(soundRequestRef);
    if (videoRef.current) videoRef.current.muted = true;
    setPlaybackNotice("");
  }

  async function enableSound(fromClick = false) {
    const video = videoRef.current;
    if (!video || !visibleRef.current || document.hidden) return;
    // Hover changes sound without overriding a deliberate pause.
    if (video.paused && !fromClick) return;
    const request = nextSoundRequest(soundRequestRef);
    video.muted = false;
    setPlaybackNotice("");
    try {
      await video.play();
    } catch {
      if (request !== soundRequestRef.current) return;
      video.muted = true;
      setPlaybackNotice("Cliquez sur le haut-parleur pour activer le son.");
      // Some browsers pause the video when hover-unmuting is disallowed.
      void video.play().catch(() => {});
    }
  }

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackNotice("");
    try {
      await video.play();
      video.focus();
    } catch {
      setPlaybackNotice("La lecture n’a pas démarré. Appuyez sur lecture pour réessayer.");
    }
  }

  return (
    <div
      className="relative aspect-[9/16]"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") void enableSound();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") muteVideo();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) muteVideo();
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        width={1280}
        height={720}
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        tabIndex={0}
        aria-label={t.playerAria.replace("{id}", id)}
        aria-describedby={`scout-days-video-caption-${id}`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-cover [&:fullscreen]:object-contain"
        style={{ objectPosition: position }}
      >
        {t.unsupported}
        <a href={src}>{t.openVideo}</a>.
      </video>

      <span aria-hidden className="pointer-events-none absolute top-5 left-5 font-mono text-[11px] tracking-[0.2em] text-white/75">{id}</span>
      {!failed && (
        <button
          type="button"
          onClick={() => {
            if (videoRef.current?.muted) void enableSound(true);
            else muteVideo();
          }}
          aria-label={(isMuted ? t.unmute : t.mute).replace("{id}", id)}
          aria-pressed={!isMuted}
          title={isMuted ? "Activer le son" : "Couper le son"}
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {isMuted ? <VolumeXIcon className="size-4" aria-hidden /> : <Volume2Icon className="size-4" aria-hidden />}
        </button>
      )}

      {!isPlaying && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <button
            type="button"
            onClick={playVideo}
            aria-label={t.play.replace("{id}", id)}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <PlayIcon className="ml-0.5 size-6" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      )}

      {failed ? (
        <p role="alert" className="absolute inset-x-3 bottom-16 rounded-xl bg-black/90 p-4 text-xs leading-relaxed text-(--site-muted)">
          La vidéo est momentanément indisponible.{" "}
          <a href={src} className="text-(--site-accent) underline underline-offset-4">Ouvrir directement</a>.
        </p>
      ) : playbackNotice ? (
        <p role="status" className="pointer-events-none absolute inset-x-3 bottom-16 rounded-xl bg-black/90 p-4 text-xs leading-relaxed text-(--site-muted)">{playbackNotice}</p>
      ) : null}
    </div>
  );
}
