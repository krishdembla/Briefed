import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/db/supabase-service";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchPin(id: string) {
  const { data, error } = await supabase
    .from("pins")
    .select("id, headline, summary, stat_1, stat_2, stat_3, topic, source_name, source_url, published_at, region_label")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pin = await fetchPin(id);
  if (!pin) return { title: "Story not found — Briefed" };

  const description = (pin.summary as string | null) ?? (pin.headline as string);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://briefed.app";

  return {
    title: `${pin.headline} — Briefed`,
    description,
    openGraph: {
      title: pin.headline as string,
      description,
      url: `${appUrl}/pin/${id}`,
      siteName: "Briefed",
      type: "article",
    },
    twitter: {
      card: "summary",
      title: pin.headline as string,
      description,
    },
  };
}

export default async function PinPage({ params }: Props) {
  const { id } = await params;
  const pin = await fetchPin(id);
  if (!pin) notFound();

  const color = TOPIC_COLORS[(pin.topic as string) ?? "other"] ?? TOPIC_COLORS.other;
  const label = TOPIC_LABELS[(pin.topic as string) ?? "other"] ?? "Other";
  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">

        {/* Wordmark */}
        <p className="text-center text-sm font-bold text-zinc-500 mb-8 tracking-widest uppercase">
          Briefed
        </p>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          {/* Topic + region */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ backgroundColor: color + "1f", color }}
            >
              {label}
            </span>
            {pin.region_label && (
              <span className="text-xs text-zinc-500">{pin.region_label as string}</span>
            )}
            <span className="text-xs text-zinc-600 ml-auto">
              {timeAgo(pin.published_at as string)}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-white font-bold text-lg leading-snug mb-3">
            {pin.headline as string}
          </h1>

          {/* Summary */}
          {pin.summary && (
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              {pin.summary as string}
            </p>
          )}

          {/* Stats */}
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {stats.map((stat, i) => (
                <span
                  key={i}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300"
                >
                  {stat}
                </span>
              ))}
            </div>
          )}

          {/* Source */}
          <a
            href={pin.source_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-indigo-400 underline underline-offset-2 transition-colors"
          >
            {pin.source_name as string}
          </a>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block bg-white text-zinc-900 font-semibold text-sm px-6 py-3 rounded-2xl hover:bg-zinc-100 transition-colors"
          >
            Open the full map →
          </Link>
          <p className="text-xs text-zinc-600 mt-3">
            Briefed — your daily world news, mapped
          </p>
        </div>
      </div>
    </div>
  );
}
