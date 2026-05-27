"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPin } from "@/types/map";
import { TOPIC_COLORS } from "@/types/map";

interface SearchBarProps {
  pins: MapPin[];
  onSelectPin: (pin: MapPin) => void;
}

const MAX_RESULTS = 8;

function matchPins(pins: MapPin[], query: string): MapPin[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return pins
    .filter(
      (p) =>
        p.headline.toLowerCase().includes(q) ||
        (p.region_label ?? "").toLowerCase().includes(q) ||
        (p.country_code ?? "").toLowerCase().includes(q) ||
        (p.topic ?? "").toLowerCase().includes(q)
    )
    .slice(0, MAX_RESULTS);
}

export default function SearchBar({ pins, onSelectPin }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = matchPins(pins, query);

  function expand() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function collapse() {
    setOpen(false);
    setQuery("");
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
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={expand}
          aria-label="Search pins"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all shadow-lg"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute top-4 right-4 z-10 w-72">
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

      {/* Dropdown results */}
      {query.trim() && (
        <div className="mt-1.5 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">No matches found</p>
          ) : (
            <ul>
              {results.map((pin, i) => {
                const color = TOPIC_COLORS[pin.topic ?? "other"] ?? TOPIC_COLORS.other;
                return (
                  <li key={pin.id}>
                    <button
                      onClick={() => handleSelect(pin)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800/70 transition-colors ${
                        i < results.length - 1 ? "border-b border-zinc-800/60" : ""
                      }`}
                    >
                      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200 leading-snug line-clamp-2">{pin.headline}</p>
                        {pin.region_label && (
                          <p className="text-xs text-zinc-500 mt-0.5">{pin.region_label}</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Hint when input is empty */}
      {!query.trim() && (
        <p className="mt-2 text-xs text-zinc-600 text-center">
          Type a headline, region, or topic
        </p>
      )}
    </div>
  );
}
