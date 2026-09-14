"use client";

// @refresh reset
// Media observers and in-flight play promises must not reuse pre-edit refs.

import { useEffect, useRef, useState } from "react";
import { Volume2Icon, VolumeXIcon } from "lucide-react";

import { PlayToggle } from "@/components/site/play-toggle";
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
  // Une pause demandee a la main doit tenir : sans ce drapeau, le premier
  // evenement de l'observateur relancerait la lecture juste apres le clic.
  const pausedByUserRef = useRef(false);
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
        // Sortir du champ remet le compteur a zero : la pause vaut pour
        // l'apercu qu'on regarde, elle ne le condamne pas pour la visite.
        pausedByUserRef.current = false;
        video!.pause();
        return;
      }
      if (pausedByUserRef.current) return;
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

  /**
   * Rend le son, et demarre la lecture si l'apercu etait a l'arret.
   *
   * Le survol passait autrefois son tour sur une video en pause. Il la
   * relance desormais : c'est le geste attendu quand on pose le curseur sur
   * une vignette, et il n'y a pas de demi-mesure utile — une video qu'on
   * survole et qui reste figee ne dit rien de plus que sa poster.
   */
  async function enableSound() {
    const video = videoRef.current;
    if (!video || !visibleRef.current || document.hidden) return;
    const request = nextSoundRequest(soundRequestRef);
    video.muted = false;
    setPlaybackNotice("");
    try {
      await video.play();
    } catch {
      if (request !== soundRequestRef.current) return;
      video.muted = true;
      setPlaybackNotice(dict.video.soundBlocked);
      // Some browsers pause the video when hover-unmuting is disallowed.
      void video.play().catch(() => {});
    }
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackNotice("");
    if (!video.paused) {
      pausedByUserRef.current = true;
      video.pause();
      return;
    }
    pausedByUserRef.current = false;
    try {
      await video.play();
    } catch {
      setPlaybackNotice(dict.video.playbackFailed);
    }
  }

  // Le survol lance l'apercu et lui rend le son ; le quitter le remet en
  // sourdine sans l'arreter — il reste a l'ecran, il continue.
  //
  // `pointerenter` ne se declenche qu'en *entrant* dans la carte, et ne
  // remonte pas depuis les boutons qu'elle contient : c'est ce qui permet a la
  // pause manuelle de tenir. Sans cela, le curseur — encore pose sur le bouton
  // qu'on vient de cliquer — relancerait aussitot la lecture, et la pause
  // paraitrait cassee. Sortir de la carte puis y revenir relance, ce qui est
  // bien ce qu'on demande alors.
  //
  // Filtre sur la souris : un telephone n'a pas de survol, et le
  // `pointerenter` qu'il synthetise au toucher ferait sonner la video au
  // premier effleurement de la page.
  return (
    <div
      className="relative aspect-[9/16]"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        pausedByUserRef.current = false;
        void enableSound();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") muteVideo();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) muteVideo();
      }}
    >
      {/* Pas de `controls` : la barre native s'affiche en permanence sur
          telephone, doublait le bouton de son deja present et posait une
          reglette de lecture sur un apercu de dix secondes qui demarre seul.
          Les deux seuls gestes qui ont un sens ici — lecture/pause et son —
          sont les deux boutons ci-dessous. Le `tabIndex` de la video a suivi :
          sans commandes natives, ce n'etait plus qu'un arret de tabulation
          sans action. */}
      <video
        ref={videoRef}
        poster={poster}
        width={1280}
        height={720}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
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
            if (!videoRef.current?.muted) {
              muteVideo();
              return;
            }
            // Demander le son sur un apercu a l'arret, c'est demander a le voir.
            pausedByUserRef.current = false;
            void enableSound();
          }}
          aria-label={(isMuted ? t.unmute : t.mute).replace("{id}", id)}
          aria-pressed={!isMuted}
          title={isMuted ? "Activer le son" : "Couper le son"}
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {isMuted ? <VolumeXIcon className="size-4" aria-hidden /> : <Volume2Icon className="size-4" aria-hidden />}
        </button>
      )}

      {/* Le voile n'apparait qu'a l'arret : sur une video qui joue il
          assombrirait l'image pour rien. */}
      {!isPlaying && !failed && <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/25" />}

      {!failed && (
        <PlayToggle
          playing={isPlaying}
          label={isPlaying ? t.labelPause : t.labelPlay}
          ariaLabel={(isPlaying ? t.pause : t.play).replace("{id}", id)}
          onToggle={togglePlayback}
          className="absolute bottom-3 left-3"
        />
      )}

      {failed ? (
        <p role="alert" className="absolute inset-x-3 bottom-16 rounded-xl bg-black/90 p-4 text-xs leading-relaxed text-(--site-muted)">
          {dict.video.unavailable}{" "}
          <a href={src} className="text-(--site-accent) underline underline-offset-4">
            {dict.video.openDirect}
          </a>
          .
        </p>
      ) : playbackNotice ? (
        <p role="status" className="pointer-events-none absolute inset-x-3 bottom-16 rounded-xl bg-black/90 p-4 text-xs leading-relaxed text-(--site-muted)">{playbackNotice}</p>
      ) : null}
    </div>
  );
}
