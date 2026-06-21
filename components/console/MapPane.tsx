"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl, Popup, type MapRef } from "react-map-gl/maplibre";
import type { AffectedStore, ConsoleSelection } from "@/lib/types";
import { PaneShell } from "./PaneShell";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const formatter = new Intl.NumberFormat("en-US");

function storeBounds(stores: AffectedStore[]): [[number, number], [number, number]] | null {
  if (stores.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const store of stores) {
    minLng = Math.min(minLng, store.lng);
    minLat = Math.min(minLat, store.lat);
    maxLng = Math.max(maxLng, store.lng);
    maxLat = Math.max(maxLat, store.lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 z-10 bg-neutral-950/60">
      <div className="grid h-full grid-cols-4 grid-rows-4 opacity-30">
        {Array.from({ length: 16 }).map((_, index) => (
          <div key={index} className="border border-neutral-800" />
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[var(--p-red)]" />
    </div>
  );
}

export function MapPane({
  stores,
  loading,
  onSelect,
  cutoff = null,
}: {
  stores: AffectedStore[];
  loading: boolean;
  onSelect?: (selection: ConsoleSelection) => void;
  cutoff?: number | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<AffectedStore | null>(null);
  const bounds = useMemo(() => storeBounds(stores), [stores]);

  // Outbreak time-travel: when a cutoff timestamp is set, only stores the contamination
  // had reached by that moment are lit. Bounds stay fixed to ALL stores so the camera
  // never jumps as pins ignite — the spread plays out inside one stable frame.
  const visibleStores = useMemo(() => {
    if (cutoff == null) return stores;
    return stores.filter((store) => {
      const reached = Date.parse(store.arrivedAt);
      return Number.isNaN(reached) || reached <= cutoff;
    });
  }, [stores, cutoff]);

  useEffect(() => {
    if (!ready || !bounds) return;
    mapRef.current?.fitBounds(bounds, { padding: 48, duration: 700, maxZoom: 8.5 });
  }, [ready, bounds]);

  const subtitle =
    cutoff == null
      ? `${formatter.format(stores.length)} pins`
      : `${formatter.format(visibleStores.length)} / ${formatter.format(stores.length)} reached`;

  return (
    <PaneShell title="Affected stores" subtitle={subtitle}>
      <div className="relative h-full min-h-[320px] w-full">
        {loading && <MapSkeleton />}
        <Map
          ref={mapRef}
          initialViewState={{ longitude: -98.5, latitude: 39.8, zoom: 3.15 }}
          mapStyle={DARK_STYLE}
          style={{ width: "100%", height: "100%" }}
          onLoad={() => setReady(true)}
          attributionControl={false}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {visibleStores.map((store) => (
            <Marker key={store.storeId} longitude={store.lng} latitude={store.lat} anchor="center">
              <button
                type="button"
                aria-label={`${store.name}: ${formatter.format(store.units)} units recalled`}
                onFocus={() => setHovered(store)}
                onBlur={() => setHovered(null)}
                onMouseEnter={() => setHovered(store)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  onSelect?.({ kind: "store", id: store.storeId, label: store.name })
                }
                className="size-2.5 animate-pin-pulse rounded-full bg-[var(--p-red)] ring-2 ring-[var(--p-red)]/30 transition-transform hover:scale-150 focus:scale-150 focus:outline-none focus:ring-[var(--p-red)]"
                style={{ boxShadow: "0 0 7px 1px rgba(255,77,77,0.72)" }}
              />
            </Marker>
          ))}
          {hovered && (
            <Popup
              longitude={hovered.lng}
              latitude={hovered.lat}
              anchor="bottom"
              closeButton={false}
              closeOnClick={false}
              offset={12}
            >
              <div className="max-w-48 text-xs text-neutral-950">
                <div className="font-semibold">{hovered.name}</div>
                <div className="text-neutral-600">{hovered.chain}</div>
                <div className="mt-1 font-mono text-red-600">
                  {formatter.format(hovered.units)} units recalled
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </PaneShell>
  );
}
