"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection, Point } from "geojson";
import type { MapPin, TopicFilter } from "@/types/map";
import CheckInStrip from "@/components/ui/CheckInStrip";
import SearchBar from "@/components/ui/SearchBar";
import UserMenu from "@/components/ui/UserMenu";
import FeedPanel from "@/components/feed/FeedPanel";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { recordCheckin, fetchStreak } from "@/lib/db/checkins";
import { getPreferences } from "@/lib/db/preferences";
import { getSavedPinIds } from "@/lib/db/saves";
import { recordRead } from "@/lib/db/reads";
import type { PinTopic } from "@/types/pipeline";

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
  const [userTopics, setUserTopics] = useState<PinTopic[]>([]);
  const [savedPinIds, setSavedPinIds] = useState<Set<string>>(new Set());
  const [expandedPin, setExpandedPin] = useState<MapPin | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [scrollToPinId, setScrollToPinId] = useState<string | null>(null);
  const [readPins, setReadPins] = useState<Set<string>>(new Set());
  const [hideRead, setHideRead] = useState(false);
  const [freshnessDays, setFreshnessDays] = useState(5);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [mobileTab, setMobileTab] = useState<"feed" | "map">("feed");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trendingPins, setTrendingPins] = useState<MapPin[]>([]);
  const trendingFetchedRef = useRef(false);
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
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id ?? null;
      const email = data.user?.email ?? null;
      setUserId(id);
      setUserEmail(email);
      if (id) {
        fetchStreak(id).then(setStreak).catch(console.error);
        const [prefs, savedIds] = await Promise.all([
          getPreferences(id).catch(() => [] as PinTopic[]),
          getSavedPinIds(id).catch(() => [] as string[]),
        ]);
        // Blend explicit prefs (3 pts each) with reading behaviour (1 pt per read)
        // to expand the "For You" topic set beyond just saved preferences.
        const readTopicCounts = await fetch("/api/me/read-topics")
          .then((r) => r.ok ? r.json() as Promise<Record<string, number>> : {})
          .catch(() => ({} as Record<string, number>));

        const topicScores: Record<string, number> = {};
        for (const t of prefs) topicScores[t] = (topicScores[t] ?? 0) + 3;
        for (const [t, count] of Object.entries(readTopicCounts)) {
          topicScores[t] = (topicScores[t] ?? 0) + count;
        }
        // Include any topic with a pref OR 3+ reads
        const blended = Object.entries(topicScores)
          .filter(([t, score]) => prefs.includes(t as PinTopic) || score >= 3)
          .map(([t]) => t as PinTopic);

        const finalTopics = blended.length > 0 ? blended : prefs;

        if (finalTopics.length > 0) {
          setUserTopics(finalTopics);
          setActiveTopic("foryou");
        } else if (!localStorage.getItem("briefed-onboarded")) {
          setShowOnboarding(true);
        }
        if (savedIds.length > 0) {
          setSavedPinIds(new Set(savedIds));
        }
      }
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
    if (userId) recordRead(userId, pinId).catch(console.error);
  };

  // Filter pins by topic + freshness + hideRead (shared by feed and map)
  const filteredPins = useMemo<MapPin[]>(() => {
    if (activeTopic === "trending") return trendingPins;
    const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;
    let filtered = pins.filter((p) => new Date(p.published_at).getTime() >= cutoff);
    if (activeTopic === "foryou" && userTopics.length > 0) {
      filtered = filtered.filter((p) => userTopics.includes((p.topic ?? "other") as PinTopic));
    } else if (activeTopic !== "all" && activeTopic !== "foryou") {
      filtered = filtered.filter((p) => p.topic === activeTopic);
    }
    if (hideRead) filtered = filtered.filter((p) => !readPins.has(p.id));
    return filtered.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  }, [pins, activeTopic, userTopics, freshnessDays, readPins, hideRead, trendingPins]);

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
    if (userTopics.length > 0) {
      counts["foryou"] = visible.filter((p) =>
        userTopics.includes((p.topic ?? "other") as PinTopic)
      ).length;
    }
    return counts;
  }, [pins, freshnessDays, userTopics]);

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

  // Map click → expand inline in the left feed panel (consistent with feed card clicks)
  const handleMapPinClick = (pin: MapPin) => {
    setExpandedPin(pin);
    setActivePinId(pin.id);
    setScrollToPinId(pin.id);
    setMobileTab("feed"); // on mobile, switch to feed tab to show the detail
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

  // Lazy-fetch trending pins on first activation of the trending tab
  const handleTopicChange = (topic: TopicFilter) => {
    setActiveTopic(topic);
    if (topic === "trending" && !trendingFetchedRef.current) {
      trendingFetchedRef.current = true;
      fetch("/api/pins/trending")
        .then((r) => r.ok ? r.json() as Promise<MapPin[]> : [])
        .then(setTrendingPins)
        .catch(console.error);
    }
  };

  const handleOnboardingComplete = (topics: PinTopic[]) => {
    setUserTopics(topics);
    setActiveTopic("foryou");
    setShowOnboarding(false);
  };

  const handleSaveToggle = (pinId: string, isSaved: boolean) => {
    setSavedPinIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.add(pinId) : next.delete(pinId);
      return next;
    });
  };

  const handleSelectRelatedFromFeed = (pin: MapPin) => {
    setExpandedPin(pin);
    setActivePinId(pin.id);
    flyToRef.current?.(pin.lng, pin.lat);
  };

  return (
    <div className="relative w-full h-screen flex bg-zinc-50">
      {/* Onboarding modal — shown once to new signed-in users with no topic prefs */}
      {showOnboarding && userId && (
        <OnboardingModal userId={userId} onComplete={handleOnboardingComplete} />
      )}

      {/* Error banner */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white">
          <div className="text-red-500 text-sm">{error}</div>
        </div>
      )}

      {/* Left: Feed panel (40%) */}
      <div className="hidden md:flex flex-col w-[42%] max-w-[560px] min-w-[360px] h-full">
        <FeedPanel
          loading={loading}
          pins={filteredPins}
          readPins={readPins}
          savedPinIds={savedPinIds}
          userId={userId}
          activePinId={activePinId}
          activeTopic={activeTopic}
          userTopics={userTopics}
          freshnessDays={freshnessDays}
          hideRead={hideRead}
          topicCounts={topicCounts}
          expandedPin={expandedPin}
          expandedPinRelated={expandedPinRelated}
          onActivate={handleActivate}
          onOpenPin={handleOpenFromFeed}
          onCloseExpanded={handleCloseExpanded}
          onMarkRead={handleRead}
          onSaveToggle={handleSaveToggle}
          onSelectRelated={handleSelectRelatedFromFeed}
          onTopicChange={handleTopicChange}
          onFreshnessChange={setFreshnessDays}
          onToggleHideRead={() => setHideRead((v) => !v)}
          scrollToPinId={scrollToPinId}
        />
      </div>

      {/* Mobile: Feed/Map tabs */}
      <div className="md:hidden absolute inset-0 flex flex-col">
        {/* Tab content — fills remaining space */}
        <div className="flex-1 overflow-hidden relative">
          {mobileTab === "feed" && (
            <div className="absolute inset-0">
              <FeedPanel
                pins={filteredPins}
                readPins={readPins}
                savedPinIds={savedPinIds}
                userId={userId}
                activePinId={activePinId}
                activeTopic={activeTopic}
                userTopics={userTopics}
                freshnessDays={freshnessDays}
                hideRead={hideRead}
                topicCounts={topicCounts}
                expandedPin={expandedPin}
                expandedPinRelated={expandedPinRelated}
                onActivate={handleActivate}
                onOpenPin={handleOpenFromFeed}
                onCloseExpanded={handleCloseExpanded}
                onMarkRead={handleRead}
                onSaveToggle={handleSaveToggle}
                onSelectRelated={handleSelectRelatedFromFeed}
                onTopicChange={handleTopicChange}
                onFreshnessChange={setFreshnessDays}
                onToggleHideRead={() => setHideRead((v) => !v)}
                scrollToPinId={scrollToPinId}
              />
            </div>
          )}
          {mobileTab === "map" && (
            <div className="absolute inset-0">
              {!loading && !error && (
                <BriefedMap
                  geojson={geojson}
                  onPinClick={handleMapPinClick}
                  readPins={readPins}
                  onFlyTo={(fn) => { flyToRef.current = fn; }}
                  activePinId={activePinId}
                />
              )}
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
              {!expandedPin && <CheckInStrip readCount={readPins.size} streak={streak} />}
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <div
          className="shrink-0 flex bg-white border-t border-zinc-200"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <button
            onClick={() => setMobileTab("feed")}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[11px] font-semibold transition-colors ${
              mobileTab === "feed" ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={mobileTab === "feed" ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
            </svg>
            Feed
          </button>
          <button
            onClick={() => setMobileTab("map")}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[11px] font-semibold transition-colors ${
              mobileTab === "map" ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={mobileTab === "map" ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m6 7l-5.447 2.724A1 1 0 0115 19.382V8.618a1 1 0 00-1.447-.894L9 10" />
            </svg>
            Map
          </button>
        </div>
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
        {!expandedPin && <CheckInStrip readCount={readPins.size} streak={streak} />}
      </div>

    </div>
  );
}
