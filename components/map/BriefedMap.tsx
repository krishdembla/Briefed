"use client";

import { useCallback, useEffect, useRef } from "react";
import Map, {
  Source,
  Layer,
  type MapRef,
  type MapMouseEvent,
  type MapTouchEvent,
} from "react-map-gl/mapbox";
import type { FeatureCollection, Point } from "geojson";
import type { GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { MapPin } from "@/types/map";
import { TOPIC_COLORS } from "@/types/map";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface BriefedMapProps {
  geojson: FeatureCollection<Point>;
  onPinClick: (pin: MapPin) => void;
  readPins: Set<string>;
  // Called once the map is ready, passes up a flyTo function for external navigation
  onFlyTo?: (flyTo: (lng: number, lat: number) => void) => void;
  activePinId?: string | null;
  // Called on move/zoom end with the new map bounds and zoom level
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
}

// Build the Mapbox expression that maps topic → colour for individual pins
const topicColorExpression: mapboxgl.Expression = [
  "match",
  ["get", "topic"],
  ...Object.entries(TOPIC_COLORS).flatMap(([topic, color]) => [topic, color]),
  TOPIC_COLORS.other, // fallback
];

export default function BriefedMap({ geojson, onPinClick, onFlyTo, activePinId, onBoundsChange }: BriefedMapProps) {
  const mapRef = useRef<MapRef>(null);

  // Register the flyTo function with the parent once — stable reference via ref
  useEffect(() => {
    onFlyTo?.((lng, lat) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 5, duration: 700 });
    });
  // onFlyTo intentionally omitted — we only want to register once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onBoundsChange) return;
    const b = map.getBounds();
    if (!b) return;
    onBoundsChange(
      { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
      map.getZoom()
    );
  }, [onBoundsChange]);

  const handleClick = useCallback(
    (event: MapMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const layerId = feature.layer?.id;

      if (layerId === "clusters") {
        // Zoom into cluster on click
        const clusterId = feature.properties?.cluster_id as number;
        const source = mapRef.current?.getSource("pins") as GeoJSONSource | undefined;
        source?.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const coords = (feature.geometry as Point).coordinates as [number, number];
          mapRef.current?.easeTo({ center: coords, zoom, duration: 400 });
        });
      } else if (layerId === "unclustered-point") {
        onPinClick(feature.properties as MapPin);
      }
    },
    [onPinClick]
  );

  // Touch devices fire onTouchEnd rather than onClick
  const handleTouchEnd = useCallback(
    (event: MapTouchEvent) => {
      const feature = event.features?.[0];
      if (feature?.layer?.id === "unclustered-point") {
        onPinClick(feature.properties as MapPin);
      }
    },
    [onPinClick]
  );

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: 15, latitude: 20, zoom: 2 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      interactiveLayerIds={["clusters", "unclustered-point"]}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onLoad={emitBounds}
      onMoveEnd={emitBounds}
      cursor="auto"
    >
      <Source
        id="pins"
        type="geojson"
        data={geojson}
        cluster
        clusterMaxZoom={12}
        clusterRadius={45}
      >
        {/* Cluster circles */}
        <Layer
          id="clusters"
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": "#4f46e5",
            "circle-radius": ["step", ["get", "point_count"], 18, 5, 26, 20, 36],
            "circle-opacity": 0.9,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.85,
          }}
        />
        {/* Cluster count label */}
        <Layer
          id="cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 13,
          }}
          paint={{ "text-color": "#ffffff" }}
        />
        {/* Active-pin pulse halo — rendered below the pin so the dot sits on top */}
        <Layer
          id="active-halo"
          type="circle"
          filter={["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], activePinId ?? ""]]}
          paint={{
            "circle-color": ["case", ["get", "isRead"], "#6b7280", topicColorExpression],
            "circle-radius": 22,
            "circle-opacity": 0.18,
            "circle-stroke-width": 2,
            "circle-stroke-color": ["case", ["get", "isRead"], "#6b7280", topicColorExpression],
            "circle-stroke-opacity": 0.55,
          }}
        />
        {/* Individual pins:
            - Read pins: grey, small, faded
            - Unread pins: colour + size + opacity fade with age so fresh news pops */}
        <Layer
          id="unclustered-point"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": ["case", ["get", "isRead"], "#6b7280", topicColorExpression],
            // Larger circle for fresher news; read pins stay small
            "circle-radius": [
              "case", ["get", "isRead"], 5,
              ["step", ["get", "ageHours"],
                9,      // 0–24h: largest
                24, 8,  // 24–48h
                48, 7,  // 48–72h
                72, 6,  // 72h+
              ],
            ],
            // Fade older pins so today's news stands out
            "circle-opacity": [
              "case", ["get", "isRead"], 0.35,
              ["step", ["get", "ageHours"],
                0.95,     // 0–24h
                24, 0.72, // 24–48h
                48, 0.52, // 48–72h
                72, 0.35, // 72h+
              ],
            ],
            "circle-stroke-width": [
              "case", ["get", "isRead"], 0,
              ["step", ["get", "ageHours"],
                2.5,    // 0–24h: prominent stroke
                24, 2,  // 24–48h
                48, 1.5,// 48–72h
                72, 1,  // 72h+
              ],
            ],
            "circle-stroke-color": ["case", ["==", ["get", "id"], activePinId ?? ""], "#0f172a", "#ffffff"],
            "circle-stroke-opacity": [
              "case", ["get", "isRead"], 0,
              ["step", ["get", "ageHours"],
                0.9,     // 0–24h
                24, 0.65,
                48, 0.45,
                72, 0.25,
              ],
            ],
          }}
        />
      </Source>

      {/* Zoom controls — right side, vertically centred */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 backdrop-blur-sm border border-zinc-200 text-zinc-700 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-lg text-lg font-light select-none"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 backdrop-blur-sm border border-zinc-200 text-zinc-700 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-lg text-lg font-light select-none"
        >
          −
        </button>
      </div>
    </Map>
  );
}
