"use client";

import { useCallback, useRef } from "react";
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

interface BriefedMapProps {
  geojson: FeatureCollection<Point>;
  onPinClick: (pin: MapPin) => void;
}

// Build the Mapbox expression that maps topic → colour for individual pins
const topicColorExpression: mapboxgl.Expression = [
  "match",
  ["get", "topic"],
  ...Object.entries(TOPIC_COLORS).flatMap(([topic, color]) => [topic, color]),
  TOPIC_COLORS.other, // fallback
];

export default function BriefedMap({ geojson, onPinClick }: BriefedMapProps) {
  const mapRef = useRef<MapRef>(null);

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
      mapStyle="mapbox://styles/mapbox/dark-v11"
      interactiveLayerIds={["clusters", "unclustered-point"]}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
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
            "circle-color": "#6366f1",
            "circle-radius": ["step", ["get", "point_count"], 18, 5, 26, 20, 36],
            "circle-opacity": 0.85,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#818cf8",
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
        {/* Individual pins */}
        <Layer
          id="unclustered-point"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": topicColorExpression,
            "circle-radius": 8,
            "circle-opacity": 0.9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          }}
        />
      </Source>
    </Map>
  );
}
