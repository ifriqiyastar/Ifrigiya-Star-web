"use client";

import { useI18n } from "@/lib/i18n/client";
import { useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { ScoutDaysVideoPlayer } from "@/components/site/scout-days-video-player";

// The existing football clip fills all three slots until event footage is supplied.
const VIDEOS = [
  { id: "01", poster: "/videos/scout-days-preview-01.webp", position: "45% center" },
  { id: "02", poster: "/videos/scout-days-preview-02.webp", position: "50% center" },
  { id: "03", poster: "/videos/scout-days-preview-03.webp", position: "30% center" },
].map((video) => ({ ...video, src: "/videos/football-hero-720p.mp4" }));

export function ScoutDaysVideosSection() {
  const { dict } = useI18n();
  const t = dict.scoutVideos;
  const railRef = useRef<HTMLDivElement>(null);
  const [firstIndex, setFirstIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const orderedVideos = [...VIDEOS.slice(firstIndex), ...VIDEOS.slice(0, firstIndex)];

  function rotate(direction: number) {
    railRef.current?.querySelectorAll("video").forEach((video) => { video.muted = true; });
    const nextIndex = (firstIndex + direction + VIDEOS.length) % VIDEOS.length;
    setFirstIndex(nextIndex);
    setAnnouncement(
      t.announce.replace("{id}", VIDEOS[nextIndex].id).replace("{total}", String(VIDEOS.length)),
    );
    railRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  return (
    <section id="scout-days-videos" aria-labelledby="scout-days-videos-heading" className="scroll-mt-20 border-y border-(--site-line) bg-black py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex items-center justify-between gap-5">
          <h2 id="scout-days-videos-heading" className="font-heading text-2xl leading-tight font-extrabold tracking-tight uppercase sm:text-3xl lg:text-4xl">
            Scout Days en action
          </h2>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" onClick={() => rotate(-1)} aria-label="Vidéos précédentes" aria-controls="scout-days-video-rail" className="flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)">
              <ChevronLeftIcon className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => rotate(1)} aria-label="Vidéos suivantes" aria-controls="scout-days-video-rail" className="flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)">
              <ChevronRightIcon className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div
          ref={railRef}
          id="scout-days-video-rail"
          role="group"
          aria-label={t.railAria}
          onVolumeChangeCapture={(event) => {
            const activeVideo = event.target;
            if (!(activeVideo instanceof HTMLVideoElement) || activeVideo.muted) return;
            railRef.current?.querySelectorAll("video").forEach((video) => {
              if (video !== activeVideo) video.muted = true;
            });
          }}
          className="mt-9 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] sm:mt-10 [&::-webkit-scrollbar]:hidden"
        >
          {orderedVideos.map((video) => (
            <figure key={video.id} className="relative w-[min(78vw,260px)] shrink-0 snap-start overflow-hidden rounded-[20px] border border-white/15 bg-(--site-card) sm:w-[260px]">
              <ScoutDaysVideoPlayer {...video} />
              <figcaption id={`scout-days-video-caption-${video.id}`} className="sr-only">
                Aperçu football {video.id} — vidéo de démonstration sans son.
              </figcaption>
            </figure>
          ))}
        </div>
        <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
      </div>
    </section>
  );
}
