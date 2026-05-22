"use client";

import { TOPIC_COLORS, TOPIC_LABELS, type TopicFilter } from "@/types/map";

const TOPICS: TopicFilter[] = ["all", "politics", "economy", "conflict", "health", "climate", "tech"];

interface TopicFilterProps {
  active: TopicFilter;
  onChange: (topic: TopicFilter) => void;
}

export default function TopicFilter({ active, onChange }: TopicFilterProps) {
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
      </div>
    </div>
  );
}
