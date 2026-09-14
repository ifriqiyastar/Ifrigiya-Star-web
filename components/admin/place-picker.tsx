"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { MapPinIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Choix d'un point sur la carte, pendant back-office du `LocationPicker` de
 * l'application mobile (§8.1, migration 0032).
 *
 * **Aucune dependance ajoutee, et pas de WebView non plus** : les tuiles sont
 * posees en `<img>` absolus, avec la projection Web Mercator reprise telle
 * quelle de `place-map.tsx` cote mobile. Leaflet n'apporterait ici que le
 * pan/zoom, qui tient en trente lignes.
 *
 * **Fournisseur de tuiles : Esri**, comme sur mobile et pour la meme raison —
 * `tile.openstreetmap.org` bloque les applications (« App is not following the
 * tile usage policy ») et CARTO exige desormais une cle. Esri est sans cle et
 * nativement sombre. ⚠️ Son ordre d'URL est `{z}/{y}/{x}`, pas `{z}/{x}/{y}`.
 *
 * **Pas de geocodage inverse** : sur mobile il vient du geocodeur embarque
 * (`expo-location`), gratuit et sans cle. Le web n'a pas d'equivalent sans
 * compte ni quota, donc l'adresse reste saisie a la main — la carte ne remplit
 * que les coordonnees.
 */

const TILE_SIZE = 256;
const TILE_BASE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const TILE_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";

/** Tunis : le produit est tunisien, l'Atlantique est un mauvais point de depart. */
const DEFAULT_CENTER = { latitude: 36.8065, longitude: 10.1815 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

type Point = { latitude: number; longitude: number };

const tileUrl = (template: string, x: number, y: number, z: number) =>
  template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

/** Web Mercator : coordonnees -> pixel global au zoom demande. */
function project(point: Point, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = (point.latitude * Math.PI) / 180;
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * scale,
  };
}

/** L'inverse, pour transformer un clic en coordonnees. */
function unproject(x: number, y: number, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (y / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude: lat, longitude: lng };
}

export function PlacePicker({
  latitude,
  longitude,
  address,
}: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}) {
  const i18n = useAdminTranslations();

  const [size, setSize] = React.useState({ width: 640, height: 260 });
  const [zoom, setZoom] = React.useState(latitude != null ? 13 : 11);
  const [marker, setMarker] = React.useState<Point | null>(
    latitude != null && longitude != null ? { latitude, longitude } : null,
  );
  const [center, setCenter] = React.useState<Point>(
    latitude != null && longitude != null ? { latitude, longitude } : DEFAULT_CENTER,
  );
  const frame = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; moved: boolean } | null>(null);

  React.useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      if (box.width > 0) setSize({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const origin = project(center, zoom);
  const offsetX = size.width / 2 - origin.x;
  const offsetY = size.height / 2 - origin.y;

  const tiles: { key: string; x: number; y: number; left: number; top: number }[] = [];
  const count = 2 ** zoom;
  for (
    let tx = Math.floor((origin.x - size.width / 2) / TILE_SIZE);
    tx <= Math.floor((origin.x + size.width / 2) / TILE_SIZE);
    tx++
  ) {
    for (
      let ty = Math.floor((origin.y - size.height / 2) / TILE_SIZE);
      ty <= Math.floor((origin.y + size.height / 2) / TILE_SIZE);
      ty++
    ) {
      // Hors des poles il n'y a pas de tuile ; en longitude le monde boucle.
      if (ty < 0 || ty >= count) continue;
      tiles.push({
        key: `${tx}-${ty}`,
        x: ((tx % count) + count) % count,
        y: ty,
        left: tx * TILE_SIZE + offsetX,
        top: ty * TILE_SIZE + offsetY,
      });
    }
  }

  const markerPixel = marker
    ? (() => {
        const p = project(marker, zoom);
        return { left: p.x + offsetX, top: p.y + offsetY };
      })()
    : null;

  function pointFromEvent(event: React.MouseEvent) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return null;
    return unproject(
      event.clientX - box.left - offsetX,
      event.clientY - box.top - offsetY,
      zoom,
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={frame}
        onMouseDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, moved: false };
        }}
        onMouseMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const dx = event.clientX - state.x;
          const dy = event.clientY - state.y;
          if (Math.abs(dx) + Math.abs(dy) < 3) return;
          state.moved = true;
          state.x = event.clientX;
          state.y = event.clientY;
          setCenter(unproject(origin.x - dx, origin.y - dy, zoom));
        }}
        onMouseUp={(event) => {
          const state = drag.current;
          drag.current = null;
          // Un deplacement n'est pas un clic : sans ce garde, chaque
          // glissement deplacerait aussi le point.
          if (state?.moved) return;
          const point = pointFromEvent(event);
          if (point) setMarker(point);
        }}
        onMouseLeave={() => {
          drag.current = null;
        }}
        className="relative h-64 w-full cursor-crosshair overflow-hidden rounded-xl border border-border bg-background select-none"
        role="application"
        aria-label={i18n.t("Carte : cliquer pour placer le point de rendez-vous")}
      >
        {tiles.map((tile) => (
          <React.Fragment key={tile.key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tileUrl(TILE_BASE, tile.x, tile.y, zoom)}
              alt=""
              draggable={false}
              className="pointer-events-none absolute"
              style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tileUrl(TILE_LABELS, tile.x, tile.y, zoom)}
              alt=""
              draggable={false}
              className="pointer-events-none absolute"
              style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
            />
          </React.Fragment>
        ))}

        {markerPixel ? (
          <MapPinIcon
            className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-full fill-brand text-brand-foreground drop-shadow"
            style={{ left: markerPixel.left, top: markerPixel.top }}
          />
        ) : null}

        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {[
            { label: i18n.t("Zoom avant"), icon: PlusIcon, delta: 1 },
            { label: i18n.t("Zoom arriere"), icon: MinusIcon, delta: -1 },
          ].map((control) => (
            <button
              key={control.label}
              type="button"
              aria-label={control.label}
              onClick={() =>
                setZoom((current) =>
                  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + control.delta)),
                )
              }
              className="flex size-7 items-center justify-center rounded-md bg-card/90 text-foreground ring-1 ring-white/10 hover:bg-accent"
            >
              <control.icon className="size-3.5" />
            </button>
          ))}
        </div>

        <p className="pointer-events-none absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[9px] text-muted-foreground">
          © Esri © OpenStreetMap
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {marker ? (
          <>
            <span className="tabular-nums">
              {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={() => setMarker(null)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-destructive hover:bg-destructive/10"
            >
              <XIcon className="size-3" />
              {i18n.t("Retirer le point")}</button>
          </>
        ) : (
          <span>{i18n.t("Cliquez sur la carte pour placer le point (facultatif).")}</span>
        )}
      </div>

      <Input
        name="location_address"
        defaultValue={address ?? ""}
        placeholder={i18n.t("Adresse formatee, saisie a la main (le web n'a pas de geocodage sans cle)")}
        className={cn("text-sm")}
      />

      {/* Les coordonnees partent avec le formulaire. Elles vont par paire :
          `chk_scout_day_coords` refuse une latitude sans longitude. */}
      <input type="hidden" name="latitude" value={marker ? marker.latitude : ""} />
      <input type="hidden" name="longitude" value={marker ? marker.longitude : ""} />
    </div>
  );
}
