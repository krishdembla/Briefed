"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection, Point } from "geojson";
import type { MapPin, TopicFilter } from "@/types/map";
import PinCard from "@/components/pin/PinCard";
import CheckInStrip from "@/components/ui/CheckInStrip";
import SearchBar from "@/components/ui/SearchBar";
import UserMenu from "@/components/ui/UserMenu";
import FeedPanel from "@/components/feed/FeedPanel";
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
  const [expandedPin, setExpandedPin] = useState<MapPin | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [scrollToPinId, setScrollToPinId] = useState<string | null>(null);
  const [readPins, setReadPins] = useState<Set<string>>(new Set());
  const [hideRead, setHideRead] = useState(false);
  const [freshnessDays, setFreshnessDays] = useState(5);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const checkinRecordedRef = useRef(false);
  const flyToRef = useRef<((lng: number, lat: number) => void) | null>(null);

  // Fetch pins
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

  useEffect(() => {
    setReadPins(loadReadPins());
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      const email = data.user?.email ?? null;
      setUserId(id);
      setUserEmail(email);
      if (id) fetchStreak(id).then(setStreak).catch(console.error);
    });
  }, []);

  // Check-in on 3 reads
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

  // Filter pins by topic + freshness + hideRead (shared by feed and map)
  const filteredPins = useMemo<MapPin[]>(() => {
    const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;
    let filtered = pins.filter((p) => new Date(p.published_at).getTime() >= cutoff);
    if (activeTopic !== "all") filtered = filtered.filter((p) => p.topic === activeTopic);
    if (hideRead) filtered = filtered.filter((p) => !readPins.has(p.id));
    return filtered.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  }, [pins, activeTopic, freshnessDays, readPins, hideRead]);

  const geojson = useMemo<FeatureCollection<Point>>(() => ({
    type: "FeatureCollection",
    features: filteredPins.map((pin) => {
      const ageHours = (Date.now() - new Date(pin.published_at).getTime()) / 3_600_000;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
        properties: { ...pin, isRead: readPins.has(pin.id), ageHours },
      };
    }),
  }), [filteredPins, readPins]);

  const topicCounts = useMemo<Record<string, number>>(() => {
    const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;
    const visible = pins.filter((p) => new Date(p.published_at).getTime() >= cutoff);
    const counts: Record<string, number> = { all: visible.length };
    for (const pin of visible) {
      if (pin.topic) counts[pin.topic] = (counts[pin.topic] ?? 0) + 1;
    }
    return counts;
  }, [pins, freshnessDays]);

  const relatedPins = useMemo<MapPin[]>(() => {
    if (!selectedPin?.topic) return [];
    return pins
      .filter((p) => p.id !== selectedPin.id && p.topic === selectedPin.topic && !readPins.has(p.id))
      .slice(0, 3);
  }, [pins, selectedPin, readPins]);

  const expandedPinRelated = useMemo<MapPin[]>(() => {
    if (!expandedPin?.topic) return [];
    return pins
      .filter((p) => p.id !== expandedPin.id && p.topic === expandedPin.topic && !readPins.has(p.id))
      .slice(0, 3);
  }, [pins, expandedPin, readPins]);

  // Feed scroll → activate pin → fly map to it
  const handleActivate = (pinId: string) => {
    setActivePinId(pinId);
    const pin = pins.find((p) => p.id === pinId);
    if (pin) flyToRef.current?.(pin.lng, pin.lat);
  };

  // Map click → open card + scroll feed to it
  const handleMapPinClick = (pin: MapPin) => {
    setSelectedPin(pin);
    setActivePinId(pin.id);
    setScrollToPinId(pin.id);
    // Reset trigger so the same pin can be re-requested later
    setTimeout(() => setScrollToPinId(null), 100);
  };

  // Feed card click → expand inline in the panel + fly map to pin
  const handleOpenFromFeed = (pin: MapPin) => {
    setExpandedPin(pin);
    setActivePinId(pin.id);
    flyToRef.current?.(pin.lng, pin.lat);
  };

  const handleCloseExpanded = () => {
    setExpandedPin(null);
    setActivePinId(null);
  };

  const handleSelectRelatedFromFeed = (pin: MapPin) => {
    setExpandedPin(pin);
    setActivePinId(pin.id);
    flyToRef.current?.(pin.lng, pin.lat);
  };

  return (
    <div className="relative w-full h-screen flex bg-zinc-50">
      {/* Loading / error */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90">
          <div className="text-zinc-500 text-sm">Loading stories…</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white">
          <div className="text-red-500 text-sm">{error}</div>
        </div>
      )}

      {/* Left: Feed panel (40%) */}
      <div className="hidden md:flex flex-col w-[42%] max-w-[560px] min-w-[360px] h-full">
        <FeedPanel
          pins={filteredPins}
          readPins={readPins}
          activePinId={activePinId}
          activeTopic={activeTopic}
          freshnessDays={freshnessDays}
          hideRead={hideRead}
          topicCounts={topicCounts}
          expandedPin={expandedPin}
          expandedPinRelated={expandedPinRelated}
          onActivate={handleActivate}
          onOpenPin={handleOpenFromFeed}
          onCloseExpanded={handleCloseExpanded}
          onMarkRead={handleRead}
          onSelectRelated={handleSelectRelatedFromFeed}
          onTopicChange={(t) => setActiveTopic(t)}
          onFreshnessChange={setFreshnessDays}
          onToggleHideRead={() => setHideRead((v) => !v)}
          scrollToPinId={scrollToPinId}
        />
      </div>

      {/* Mobile: feed-only stacks (map hidden); on md+ shows side-by-side */}
      <div className="md:hidden absolute inset-0">
        <FeedPanel
          pins={filteredPins}
          readPins={readPins}
          activePinId={activePinId}
          activeTopic={activeTopic}
          freshnessDays={freshnessDays}
          hideRead={hideRead}
          topicCounts={topicCounts}
          expandedPin={expandedPin}
          expandedPinRelated={expandedPinRelated}
          onActivate={handleActivate}
          onOpenPin={handleOpenFromFeed}
          onCloseExpanded={handleCloseExpanded}
          onMarkRead={handleRead}
          onSelectRelated={handleSelectRelatedFromFeed}
          onTopicChange={(t) => setActiveTopic(t)}
          onFreshnessChange={setFreshnessDays}
          onToggleHideRead={() => setHideRead((v) => !v)}
          scrollToPinId={scrollToPinId}
        />
      </div>

      {/* Right: Map (60%) — hidden on mobile */}
      <div className="hidden md:block flex-1 relative h-full">
        {!loading && !error && (
          <BriefedMap
            geojson={geojson}
            onPinClick={handleMapPinClick}
            readPins={readPins}
            onFlyTo={(fn) => { flyToRef.current = fn; }}
            activePinId={activePinId}
          />
        )}

        {/* Overlays — search top right, user menu top left */}
        {userId && userEmail && (
          <UserMenu userId={userId} userEmail={userEmail} />
        )}
        <SearchBar
          pins={pins}
          onSelectPin={(pin) => {
            flyToRef.current?.(pin.lng, pin.lat);
            handleMapPinClick(pin);
          }}
        />

        {/* Streak strip overlay on map */}
        {!selectedPin && <CheckInStrip readCount={readPins.size} streak={streak} />}
      </div>

      {/* Pin card modal — global */}
      {selectedPin && (
        <PinCard
          pin={selectedPin}
          isRead={readPins.has(selectedPin.id)}
          onRead={handleRead}
          onClose={() => setSelectedPin(null)}
          relatedPins={relatedPins}
          onSelectRelated={(pin) => {
            setSelectedPin(pin);
            setActivePinId(pin.id);
            flyToRef.current?.(pin.lng, pin.lat);
          }}
        />
      )}

    </div>
  );
}
