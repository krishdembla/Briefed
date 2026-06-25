"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPin } from "@/types/map";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";
import type { PinTopic } from "@/types/pipeline";

interface SearchBarProps {
  pins: MapPin[];
  onSelectPin: (pin: MapPin) => void;
}

const MAX_RESULTS = 12;
const FILTER_TOPICS: PinTopic[] = ["politics", "economy", "conflict", "health", "climate", "tech"];

function matchPins(pins: MapPin[], query: string, topicFilter: PinTopic | null): MapPin[] {
  const q = query.toLowerCase().trim();
  const pool = topicFilter ? pins.filter((p) => p.topic === topicFilter) : pins;
  if (!q) return topicFilter ? pool.slice(0, MAX_RESULTS) : [];
  return pool
    .filter(
      (p) =>
        p.headline.toLowerCase().includes(q) ||
        (p.region_label ?? "").toLowerCase().includes(q) ||
        (p.country_code ?? "").toLowerCase().includes(q) ||
        (p.source_name ?? "").toLowerCase().includes(q)
    )
    .slice(0, MAX_RESULTS);
}

export default function SearchBar({ pins, onSelectPin }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<PinTopic | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = matchPins(pins, query, topicFilter);

  function expand() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function collapse() {
    setOpen(false);
    setQuery("");
    setTopicFilter(null);
  }

  function handleSelect(pin: MapPin) {
    onSelectPin(pin);
    collapse();
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        collapse();
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") collapse();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!open) {
    return (
      <div className="absolute right-4 z-10" style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <button
          onClick={expand}
          aria-label="Search pins"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all shadow-lg"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute right-4 z-10 w-[calc(100vw-5rem)] sm:w-72" style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
      {/* Input row */}
      <div className="flex items-center bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-2xl px-3 py-2 gap-2 shadow-xl">
        <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search headlines, regions, topics…"
          className="bg-transparent text-white text-sm placeholder-zinc-500 outline-none flex-1 min-w-0"
        />
        <button onClick={collapse} className="text-zinc-500 hover:text-white transition-colors shrink-0" aria-label="Close search">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Topic filter chips */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {FILTER_TOPICS.map((topic) => {
          const color = TOPIC_COLORS[topic];
          const active = topicFilter === topic;
          return (
            <button
              key={topic}
              onClick={() => setTopicFilter(active ? null : topic)}
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border"
              style={
                active
                  ? { backgroundColor: color + "33", borderColor: color + "88", color }
                  : { backgroundColor: "transparent", borderColor: "#3f3f46", color: "#71717a" }
              }
            >
              {TOPIC_LABELS[topic]}
            </button>
          );
        })}
      </div>

      {/* Dropdown results */}
      {(query.trim() || topicFilter) && (
        <div className="mt-1.5 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">No matches found</p>
          ) : (
            <ul>
              {results.map((pin, i) => {
                const color = TOPIC_COLORS[pin.topic ?? "other"] ?? TOPIC_COLORS.other;
                const label = TOPIC_LABELS[pin.topic ?? "other"] ?? "Other";
                return (
                  <li key={pin.id}>
                    <button
                      onClick={() => handleSelect(pin)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800/70 transition-colors ${
                        i < results.length - 1 ? "border-b border-zinc-800/60" : ""
                      }`}
                    >
                      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 leading-snug line-clamp-2">{pin.headline}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
                          {pin.region_label && (
                            <>
                              <span className="text-[10px] text-zinc-700">·</span>
                              <span className="text-[10px] text-zinc-500">{pin.region_label}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Hint when input is empty and no filter active */}
      {!query.trim() && !topicFilter && (
        <p className="mt-2 text-xs text-zinc-600 text-center">
          Filter by topic or type to search
        </p>
      )}
    </div>
  );
}
