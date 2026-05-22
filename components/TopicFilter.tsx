"use client";

import { TOPIC_COLORS, TOPIC_LABELS, type TopicFilter } from "@/types/map";

const TOPICS: TopicFilter[] = ["all", "politics", "economy", "conflict", "health", "climate", "tech"];

interface TopicFilterProps {
  active: TopicFilter;
  onChange: (topic: TopicFilter) => void;
  hideRead: boolean;
  onToggleHideRead: () => void;
  hasReadPins: boolean;
}

export default function TopicFilter({ active, onChange, hideRead, onToggleHideRead, hasReadPins }: TopicFilterProps) {
  return (
    <div className="absolute top-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
      <div className="flex gap-2 overflow-x-auto px-4 pointer-events-auto no-scrollbar">
        {TOPICS.map((topic) => {
          const isActive = active === topic;
          const color = topic === "all" ? "#ffffff" : TOPIC_COLORS[topic];

          return (
            <button
              key={topic}
              onClick={() => onChange(topic)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                isActive
                  ? "text-zinc-900 border-transparent"
                  : "bg-zinc-900/80 backdrop-blur-sm border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
              style={isActive ? { backgroundColor: color } : {}}
            >
              {TOPIC_LABELS[topic]}
            </button>
          );
        })}

        {/* Hide read toggle — only shown once at least one pin has been read */}
        {hasReadPins && (
          <button
            onClick={onToggleHideRead}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              hideRead
                ? "bg-zinc-400 text-zinc-900 border-transparent"
                : "bg-zinc-900/80 backdrop-blur-sm border-zinc-600 text-zinc-400 hover:border-zinc-400"
            }`}
          >
            {hideRead ? "Showing unread" : "Hide read"}
          </button>
        )}
      </div>
    </div>
  );
}
