"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPin, TopicFilter } from "@/types/map";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";
import type { PinTopic } from "@/types/pipeline";
import FeedCard from "./FeedCard";
import FeedDetail from "./FeedDetail";

const STANDARD_TOPICS: TopicFilter[] = ["all", "politics", "economy", "conflict", "health", "climate", "tech", "sports"];

const FRESHNESS_OPTIONS: { days: number; label: string }[] = [
  { days: 1.5, label: "Today" },
  { days: 2,   label: "2d" },
  { days: 3,   label: "3d" },
  { days: 5,   label: "5d" },
];

interface FeedPanelProps {
  loading?: boolean;
  isViewportFiltered?: boolean;
  pins: MapPin[];
  readPins: Set<string>;
  savedPinIds: Set<string>;
  userId: string | null;
  activePinId: string | null;
  activeTopic: TopicFilter;
  userTopics: PinTopic[];
  freshnessDays: number;
  hideRead: boolean;
  topicCounts: Record<string, number>;
  expandedPin: MapPin | null;
  expandedPinRelated: MapPin[];
  onActivate: (pinId: string) => void;
  onOpenPin: (pin: MapPin) => void;
  onCloseExpanded: () => void;
  onMarkRead: (pinId: string) => void;
  onSaveToggle: (pinId: string, isSaved: boolean) => void;
  onSelectRelated: (pin: MapPin) => void;
  onNotInterested: (pinId: string) => void;
  onTopicChange: (topic: TopicFilter) => void;
  onFreshnessChange: (days: number) => void;
  onToggleHideRead: () => void;
  scrollToPinId: string | null;
}

export default function FeedPanel({
  loading = false,
  isViewportFiltered = false,
  pins, readPins, savedPinIds, userId, activePinId, activeTopic, userTopics,
  freshnessDays, hideRead, topicCounts,
  expandedPin, expandedPinRelated,
  onActivate, onOpenPin, onCloseExpanded, onMarkRead, onSaveToggle, onSelectRelated, onNotInterested,
  onTopicChange, onFreshnessChange, onToggleHideRead, scrollToPinId,
}: FeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  // Topic-pill row: mouse users (no trackpad) can't scroll a horizontal strip
  // with the wheel, so pills on the right (Tech, Sports) become unreachable.
  // We translate vertical wheel → horizontal scroll and show edge fades +
  // clickable chevrons so the overflow is discoverable and clickable.
  const pillsRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const syncPillFades = () => {
    const el = pillsRef.current;
    if (!el) return;
    setFadeLeft(el.scrollLeft > 4);
    setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scrollPills = (dir: 1 | -1) => {
    pillsRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  useEffect(() => {
    setScrollRoot(scrollRef.current);
  }, []);

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    syncPillFades();
    // Non-passive listener so preventDefault works (React's onWheel is passive).
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // let native horizontal gestures through
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(syncPillFades);
    ro.observe(el);
    return () => { el.removeEventListener("wheel", onWheel); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync fades when the set of pills changes (For You appears, counts load).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(syncPillFades, [userTopics.length, activeTopic, topicCounts]);

  // External requests (e.g. map pin click) to scroll a specific card into view
  useEffect(() => {
    if (!scrollToPinId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-pin-id="${scrollToPinId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollToPinId]);

  const totalCount = topicCounts["all"] ?? 0;
  const hasReadPins = readPins.size > 0;

  // When a pin is expanded, swap out the list for the detail view
  if (expandedPin) {
    return (
      <div className="flex flex-col h-full border-r border-rule">
        <FeedDetail
          pin={expandedPin}
          isRead={readPins.has(expandedPin.id)}
          isSaved={savedPinIds.has(expandedPin.id)}
          userId={userId}
          relatedPins={expandedPinRelated}
          onBack={onCloseExpanded}
          onRead={onMarkRead}
          onSaveToggle={(isSaved) => onSaveToggle(expandedPin.id, isSaved)}
          onSelectRelated={onSelectRelated}
          onNotInterested={onNotInterested}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-paper border-r border-rule">
      {/* Masthead header */}
      <div
        className="shrink-0 px-5 pt-5 pb-3 bg-paper/90 backdrop-blur-md border-b border-rule"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-baseline justify-between mb-3.5">
          <h1 className="font-serif text-2xl tracking-tight text-ink">Briefed</h1>
          <span className="text-[11px] uppercase tracking-[0.15em] text-ink-faint tnum">
            {totalCount} stories
          </span>
        </div>

        {/* Topic pills — horizontally scrollable with wheel support + edge cues */}
        <div className="relative -mx-1">
          {/* Left fade + scroll-back chevron */}
          {fadeLeft && (
            <button
              onClick={() => scrollPills(-1)}
              aria-label="Scroll topics left"
              className="absolute left-0 top-0 bottom-2 z-10 flex items-center pl-1 pr-7 bg-gradient-to-r from-paper via-paper to-transparent"
            >
              <span className="w-5 h-5 rounded-full bg-paper-raised border border-rule shadow-sm flex items-center justify-center text-ink-soft">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </span>
            </button>
          )}
          {/* Right fade + scroll-forward chevron */}
          {fadeRight && (
            <button
              onClick={() => scrollPills(1)}
              aria-label="Scroll topics right"
              className="absolute right-0 top-0 bottom-2 z-10 flex items-center pr-1 pl-7 bg-gradient-to-l from-paper via-paper to-transparent"
            >
              <span className="w-5 h-5 rounded-full bg-paper-raised border border-rule shadow-sm flex items-center justify-center text-ink-soft">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          )}
          <div ref={pillsRef} onScroll={syncPillFades} className="flex gap-1.5 overflow-x-auto no-scrollbar px-1 pb-2">
          {/* For You pill — only shown when user has saved preferences */}
          {userTopics.length > 0 && (() => {
            const isActive = activeTopic === "foryou";
            const count = topicCounts["foryou"] ?? 0;
            return (
              <button
                key="foryou"
                onClick={() => onTopicChange("foryou")}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-accent text-white border-transparent"
                    : "bg-paper-raised text-ink-soft border-rule hover:border-rule-strong"
                }`}
              >
                {TOPIC_LABELS["foryou"]}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold rounded-full leading-none tnum ${
                    isActive ? "bg-white/25 text-white" : "bg-paper-sunken text-ink-faint"
                  }`}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Trending pill — always shown */}
          {(() => {
            const isActive = activeTopic === "trending";
            return (
              <button
                onClick={() => onTopicChange("trending")}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "text-white border-transparent"
                    : "bg-paper-raised text-ink-soft border-rule hover:border-rule-strong"
                }`}
                style={isActive ? { backgroundColor: TOPIC_COLORS.sports } : {}}
              >
                {TOPIC_LABELS["trending"]}
              </button>
            );
          })()}

          {STANDARD_TOPICS.map((topic) => {
            const isActive = activeTopic === topic;
            const color = topic === "all" ? "var(--accent)" : TOPIC_COLORS[topic];
            const count = topicCounts[topic] ?? 0;
            return (
              <button
                key={topic}
                onClick={() => onTopicChange(topic)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "text-white border-transparent"
                    : "bg-paper-raised text-ink-soft border-rule hover:border-rule-strong"
                }`}
                style={isActive ? { backgroundColor: color } : {}}
              >
                {TOPIC_LABELS[topic]}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold rounded-full leading-none tnum ${
                    isActive ? "bg-white/25 text-white" : "bg-paper-sunken text-ink-faint"
                  }`}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>

        {/* Freshness + hide-read */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1">
            {FRESHNESS_OPTIONS.map(({ days, label }) => {
              const isActive = freshnessDays === days;
              return (
                <button
                  key={days}
                  onClick={() => onFreshnessChange(days)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    isActive
                      ? "bg-ink text-paper"
                      : "text-ink-faint hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {hasReadPins && (
            <button
              onClick={onToggleHideRead}
              className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                hideRead ? "bg-accent/10 text-accent" : "text-ink-faint hover:text-ink"
              }`}
            >
              {hideRead ? "Showing unread" : "Hide read"}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable feed — slim rows separated by hairlines, like a newspaper index */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-rule">
        {loading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3.5 px-4 py-3.5 animate-pulse">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-16 h-3 rounded-full bg-paper-sunken" />
                    <div className="w-10 h-3 rounded-full bg-paper-sunken ml-auto" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3.5 bg-paper-sunken rounded w-full" />
                    <div className="h-3.5 bg-paper-sunken rounded w-4/6" />
                  </div>
                  <div className="h-3 w-24 rounded bg-paper-sunken mt-2.5" />
                </div>
                <div className="w-24 h-24 rounded-md bg-paper-sunken shrink-0" />
              </div>
            ))}
          </>
        )}
        {!loading && pins.length === 0 && (
          <div className="text-center text-sm text-ink-faint py-12">
            {isViewportFiltered
              ? "No stories in this area — zoom out to see more."
              : "No stories match these filters."}
          </div>
        )}
        {!loading && pins.map((pin) => (
          <FeedCard
            key={pin.id}
            pin={pin}
            isRead={readPins.has(pin.id)}
            isActive={activePinId === pin.id}
            onActivate={onActivate}
            onOpen={onOpenPin}
            onNotInterested={onNotInterested}
            scrollRoot={scrollRoot}
          />
        ))}
        <div
          className="h-16 md:h-16"
          style={{ height: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
        />
      </div>
    </div>
  );
}
