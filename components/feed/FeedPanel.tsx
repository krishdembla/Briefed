"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPin, TopicFilter } from "@/types/map";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";
import FeedCard from "./FeedCard";
import FeedDetail from "./FeedDetail";

const TOPICS: TopicFilter[] = ["all", "politics", "economy", "conflict", "health", "climate", "tech"];

const FRESHNESS_OPTIONS: { days: number; label: string }[] = [
  { days: 1.5, label: "Today" },
  { days: 2,   label: "2d" },
  { days: 3,   label: "3d" },
  { days: 5,   label: "5d" },
];

interface FeedPanelProps {
  pins: MapPin[];
  readPins: Set<string>;
  activePinId: string | null;
  activeTopic: TopicFilter;
  freshnessDays: number;
  hideRead: boolean;
  topicCounts: Record<string, number>;
  expandedPin: MapPin | null;
  expandedPinRelated: MapPin[];
  onActivate: (pinId: string) => void;
  onOpenPin: (pin: MapPin) => void;
  onCloseExpanded: () => void;
  onMarkRead: (pinId: string) => void;
  onSelectRelated: (pin: MapPin) => void;
  onTopicChange: (topic: TopicFilter) => void;
  onFreshnessChange: (days: number) => void;
  onToggleHideRead: () => void;
  scrollToPinId: string | null;
}

export default function FeedPanel({
  pins, readPins, activePinId, activeTopic, freshnessDays, hideRead, topicCounts,
  expandedPin, expandedPinRelated,
  onActivate, onOpenPin, onCloseExpanded, onMarkRead, onSelectRelated,
  onTopicChange, onFreshnessChange, onToggleHideRead, scrollToPinId,
}: FeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setScrollRoot(scrollRef.current);
  }, []);

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
      <div className="flex flex-col h-full border-r border-zinc-200">
        <FeedDetail
          pin={expandedPin}
          isRead={readPins.has(expandedPin.id)}
          relatedPins={expandedPinRelated}
          onBack={onCloseExpanded}
          onRead={onMarkRead}
          onSelectRelated={onSelectRelated}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-zinc-50 to-white border-r border-zinc-200">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-baseline justify-between mb-3">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">
            <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">Briefed</span>
            <span className="ml-2 text-xs font-medium text-zinc-500">
              {totalCount} stories
            </span>
          </h1>
        </div>

        {/* Topic pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-2">
          {TOPICS.map((topic) => {
            const isActive = activeTopic === topic;
            const color = topic === "all" ? "#4f46e5" : TOPIC_COLORS[topic];
            const count = topicCounts[topic] ?? 0;
            return (
              <button
                key={topic}
                onClick={() => onTopicChange(topic)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  isActive
                    ? "text-white border-transparent shadow-sm"
                    : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                }`}
                style={isActive ? { backgroundColor: color } : {}}
              >
                {TOPIC_LABELS[topic]}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full leading-none ${
                    isActive ? "bg-white/25 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
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
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:text-zinc-900"
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
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
                hideRead ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {hideRead ? "Showing unread" : "Hide read"}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {pins.length === 0 && (
          <div className="text-center text-sm text-zinc-500 py-12">
            No stories match these filters.
          </div>
        )}
        {pins.map((pin) => (
          <FeedCard
            key={pin.id}
            pin={pin}
            isRead={readPins.has(pin.id)}
            isActive={activePinId === pin.id}
            onActivate={onActivate}
            onOpen={onOpenPin}
            scrollRoot={scrollRoot}
          />
        ))}
        <div className="h-16" />
      </div>
    </div>
  );
}
