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
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">

        {/* Wordmark */}
        <p className="text-center font-serif text-2xl text-ink mb-8">
          Briefed
        </p>

        {/* Card */}
        <div className="bg-paper-raised border border-rule rounded-lg p-6 shadow-sm">
          {/* Topic + region */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
            {pin.region_label && (
              <span className="text-xs text-ink-faint">· {pin.region_label as string}</span>
            )}
            <span className="text-xs text-ink-faint ml-auto tnum">
              {timeAgo(pin.published_at as string)}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-ink text-2xl leading-[1.2] mb-3">
            {pin.headline as string}
          </h1>

          {/* Summary */}
          {pin.summary && (
            <p className="text-ink-soft text-[15px] leading-relaxed mb-4">
              {pin.summary as string}
            </p>
          )}

          {/* Stats */}
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4 border-y border-rule py-3">
              {stats.map((stat, i) => (
                <span key={i} className="text-sm text-ink-soft tnum">
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
            className="text-xs text-ink-soft hover:text-accent underline underline-offset-2 transition-colors"
          >
            {pin.source_name as string}
          </a>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block bg-accent text-white font-medium text-sm px-6 py-3 rounded-md hover:bg-accent-hover transition-colors"
          >
            Open the full map →
          </Link>
          <p className="text-xs text-ink-faint mt-3">
            Briefed — your daily world news, mapped
          </p>
        </div>
      </div>
    </div>
  );
}
