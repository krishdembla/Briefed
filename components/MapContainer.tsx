"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection, Point } from "geojson";
import type { MapPin, TopicFilter } from "@/types/map";
import TopicFilter_Component from "./TopicFilter";
import PinCard from "./PinCard";
import CheckInStrip from "./CheckInStrip";
import SearchBar from "./SearchBar";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { recordCheckin, fetchStreak } from "@/lib/db/checkins";

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
  const [freshnessDays, setFreshnessDays] = useState(1.5);
  const [userId, setUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const checkinRecordedRef = useRef(false);
  const flyToRef = useRef<((lng: number, lat: number) => void) | null>(null);

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

  // Resolve the authenticated user and load their streak
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) fetchStreak(id).then(setStreak).catch(console.error);
    });
  }, []);

  // Record a checkin the first time 3 pins are read in a session
  useEffect(() => {
    if (readPins.size >= 3 && userId && !checkinRecordedRef.current) {
      checkinRecordedRef.current = true;
      recordCheckin(userId, readPins.size)
        .then(() => fetchStreak(userId))
        .then(setStreak)
        .catch(console.error);
    }
  }, [readPins, userId]);

  const handleRead = (pinId: string) => {
    setReadPins((prev) => {
      const next = new Set(prev).add(pinId);
      saveReadPins(next);
      return next;
    });
  };

  // Filter pins by topic + freshness + hideRead, then convert to GeoJSON
  const geojson = useMemo<FeatureCollection<Point>>(() => {
    const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;

    let filtered = pins.filter((p) => new Date(p.published_at).getTime() >= cutoff);

    if (activeTopic !== "all") {
      filtered = filtered.filter((p) => p.topic === activeTopic);
    }

    if (hideRead) {
      filtered = filtered.filter((p) => !readPins.has(p.id));
    }

    return {
      type: "FeatureCollection",
      features: filtered.map((pin) => {
        const ageHours = (Date.now() - new Date(pin.published_at).getTime()) / 3_600_000;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
          // All properties must be primitives — GeoJSON spec requirement
          properties: { ...pin, isRead: readPins.has(pin.id), ageHours },
        };
      }),
    };
  }, [pins, activeTopic, freshnessDays, readPins, hideRead]);

  // Article counts per topic for the current freshness window (drives badge numbers)
  const topicCounts = useMemo<Record<string, number>>(() => {
    const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;
    const visible = pins.filter((p) => new Date(p.published_at).getTime() >= cutoff);
    const counts: Record<string, number> = { all: visible.length };
    for (const pin of visible) {
      if (pin.topic) counts[pin.topic] = (counts[pin.topic] ?? 0) + 1;
    }
    return counts;
  }, [pins, freshnessDays]);

  // Up to 3 unread pins sharing the same topic as the selected pin (for "More on this topic")
  const relatedPins = useMemo<MapPin[]>(() => {
    if (!selectedPin?.topic) return [];
    return pins
      .filter((p) => p.id !== selectedPin.id && p.topic === selectedPin.topic && !readPins.has(p.id))
      .slice(0, 3);
  }, [pins, selectedPin, readPins]);

  const readCount = readPins.size;

  return (
    <div className="relative w-full h-screen bg-zinc-950">
      {/* Map */}
      {!loading && !error && (
        <BriefedMap
          geojson={geojson}
          onPinClick={setSelectedPin}
          readPins={readPins}
          onFlyTo={(fn) => { flyToRef.current = fn; }}
        />
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
        freshnessDays={freshnessDays}
        onFreshnessChange={setFreshnessDays}
        topicCounts={topicCounts}
      />

      {/* Search bar — top right: autocomplete dropdown + fly-to */}
      <SearchBar
        pins={pins}
        onSelectPin={(pin) => {
          flyToRef.current?.(pin.lng, pin.lat);
          setSelectedPin(pin);
        }}
      />

      {/* Pin card — overlaid at bottom when a pin is selected */}
      {selectedPin && (
        <PinCard
          pin={selectedPin}
          isRead={readPins.has(selectedPin.id)}
          onRead={handleRead}
          onClose={() => setSelectedPin(null)}
          relatedPins={relatedPins}
          onSelectRelated={setSelectedPin}
        />
      )}

      {/* Check-in strip — only visible when no pin card is open */}
      {!selectedPin && (
        <CheckInStrip readCount={readCount} streak={streak} />
      )}
    </div>
  );
}
