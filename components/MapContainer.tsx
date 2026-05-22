"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection, Point } from "geojson";
import type { MapPin, TopicFilter } from "@/types/map";
import TopicFilter_Component from "./TopicFilter";
import PinCard from "./PinCard";
import CheckInStrip from "./CheckInStrip";

// Dynamic import avoids SSR entirely for the Mapbox component
const BriefedMap = dynamic(() => import("./BriefedMap"), { ssr: false });

const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const STORAGE_KEY = `briefed-checkin-${TODAY}`;

function loadReadPins(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadPins(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — silently continue
  }
}

export default function MapContainer() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTopic, setActiveTopic] = useState<TopicFilter>("all");
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [readPins, setReadPins] = useState<Set<string>>(new Set());
  const [hideRead, setHideRead] = useState(false);

  // Fetch pins from the API route
  useEffect(() => {
    fetch("/api/pins")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MapPin[]>;
      })
      .then((data) => {
        setPins(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[MapContainer] Failed to fetch pins:", err);
        setError("Failed to load pins. Please refresh.");
        setLoading(false);
      });
  }, []);

  // Load read pins from localStorage after mount
  useEffect(() => {
    setReadPins(loadReadPins());
  }, []);

  const handleRead = (pinId: string) => {
    setReadPins((prev) => {
      const next = new Set(prev).add(pinId);
      saveReadPins(next);
      return next;
    });
  };

  // Filter pins by topic + hideRead, then convert to GeoJSON with isRead flag
  const geojson = useMemo<FeatureCollection<Point>>(() => {
    let filtered = activeTopic === "all"
      ? pins
      : pins.filter((p) => p.topic === activeTopic);

    if (hideRead) {
      filtered = filtered.filter((p) => !readPins.has(p.id));
    }

    return {
      type: "FeatureCollection",
      features: filtered.map((pin) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
        // All properties must be primitives — GeoJSON spec requirement
        properties: { ...pin, isRead: readPins.has(pin.id) },
      })),
    };
  }, [pins, activeTopic, readPins, hideRead]);

  const readCount = readPins.size;

  return (
    <div className="relative w-full h-screen bg-zinc-950">
      {/* Map */}
      {!loading && !error && (
        <BriefedMap geojson={geojson} onPinClick={setSelectedPin} readPins={readPins} />
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-zinc-400 text-sm">Loading pins…</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      {/* Topic filter — overlaid at top */}
      <TopicFilter_Component
        active={activeTopic}
        onChange={(t) => { setActiveTopic(t); setSelectedPin(null); }}
        hideRead={hideRead}
        onToggleHideRead={() => setHideRead((v) => !v)}
        hasReadPins={readPins.size > 0}
      />

      {/* Pin card — overlaid at bottom when a pin is selected */}
      {selectedPin && (
        <PinCard
          pin={selectedPin}
          isRead={readPins.has(selectedPin.id)}
          onRead={handleRead}
          onClose={() => setSelectedPin(null)}
        />
      )}

      {/* Check-in strip — only visible when no pin card is open */}
      {!selectedPin && (
        <CheckInStrip readCount={readCount} />
      )}
    </div>
  );
}
