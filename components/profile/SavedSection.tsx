"use client";

import { useEffect, useState } from "react";
import {
  getAlbums,
  createAlbum,
  deleteAlbum,
  getSavedPins,
  unsavePin,
  type PinAlbum,
  type SavedPinEntry,
} from "@/lib/db/saves";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";

interface SavedSectionProps {
  userId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function SavedSection({ userId }: SavedSectionProps) {
  const [albums, setAlbums] = useState<PinAlbum[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [activeAlbum, setActiveAlbum] = useState<PinAlbum | null>(null);
  const [albumPins, setAlbumPins] = useState<SavedPinEntry[]>([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getAlbums(userId)
      .then(setAlbums)
      .finally(() => setLoadingAlbums(false));
  }, [userId]);

  async function openAlbum(album: PinAlbum) {
    setActiveAlbum(album);
    setLoadingPins(true);
    const pins = await getSavedPins(album.id).catch(() => []);
    setAlbumPins(pins);
    setLoadingPins(false);
  }

  async function handleCreateAlbum() {
    const name = newAlbumName.trim();
    if (!name || savingAlbum) return;
    setSavingAlbum(true);
    try {
      const album = await createAlbum(userId, name);
      setAlbums((prev) => [...prev, album]);
      setNewAlbumName("");
      setCreatingAlbum(false);
    } catch (err) {
      console.error("[SavedSection] createAlbum failed:", err);
    } finally {
      setSavingAlbum(false);
    }
  }

  async function handleDeleteAlbum(album: PinAlbum) {
    if (deletingId) return;
    setDeletingId(album.id);
    try {
      await deleteAlbum(album.id);
      setAlbums((prev) => prev.filter((a) => a.id !== album.id));
      if (activeAlbum?.id === album.id) setActiveAlbum(null);
    } catch (err) {
      console.error("[SavedSection] deleteAlbum failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRemovePin(entry: SavedPinEntry) {
    if (!activeAlbum) return;
    await unsavePin(entry.pinId, activeAlbum.id).catch(console.error);
    setAlbumPins((prev) => prev.filter((e) => e.id !== entry.id));
    setAlbums((prev) =>
      prev.map((a) => a.id === activeAlbum.id ? { ...a, pinCount: Math.max(0, a.pinCount - 1) } : a)
    );
    setActiveAlbum((prev) => prev ? { ...prev, pinCount: Math.max(0, prev.pinCount - 1) } : prev);
  }

  // ── Album detail view ──────────────────────────────────────────────────────
  if (activeAlbum) {
    return (
      <div className="bg-paper-raised border border-rule rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-rule">
          <button
            onClick={() => setActiveAlbum(null)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-paper-sunken text-ink-soft hover:text-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-lg text-ink truncate">{activeAlbum.name}</p>
            <p className="text-xs text-ink-faint tnum">{activeAlbum.pinCount} saved</p>
          </div>
        </div>

        {/* Pins list */}
        <div className="divide-y divide-rule">
          {loadingPins && (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 rounded-full border-2 border-rule border-t-accent animate-spin" />
            </div>
          )}
          {!loadingPins && albumPins.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-ink-faint">
              No stories saved here yet.
            </div>
          )}
          {!loadingPins && albumPins.map((entry) => {
            const p = entry.pin;
            if (!p) return null;
            const color = TOPIC_COLORS[p.topic ?? "other"] ?? TOPIC_COLORS.other;
            const label = TOPIC_LABELS[p.topic ?? "other"] ?? "Other";
            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3.5 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] shrink-0"
                      style={{ color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                    {p.region_label && (
                      <span className="text-[10px] text-ink-faint truncate">{p.region_label}</span>
                    )}
                    <span className="text-[10px] text-ink-faint ml-auto shrink-0 tnum">{timeAgo(entry.savedAt)}</span>
                  </div>
                  <p className="font-serif text-[15px] text-ink leading-snug line-clamp-2 mb-1">{p.headline}</p>
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-ink-faint hover:text-accent underline underline-offset-2 transition-colors"
                  >
                    {p.source_name}
                  </a>
                </div>
                <button
                  onClick={() => handleRemovePin(entry)}
                  title="Remove from collection"
                  className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-ink-faint hover:text-[#9e4a3c] hover:bg-[#9e4a3c]/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Albums grid view ───────────────────────────────────────────────────────
  return (
    <div className="bg-paper-raised border border-rule rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em]">Saved</p>
          <p className="text-xs text-ink-faint mt-0.5">Your reading collections</p>
        </div>
        {!creatingAlbum && (
          <button
            onClick={() => setCreatingAlbum(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        )}
      </div>

      {loadingAlbums ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 rounded-full border-2 border-rule border-t-accent animate-spin" />
        </div>
      ) : (
        <>
          {albums.length === 0 && !creatingAlbum && (
            <div className="text-center py-6">
              <p className="text-sm text-ink-soft mb-3">No collections yet.</p>
              <p className="text-xs text-ink-faint">Tap the bookmark icon on any story to save it.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {albums.map((album) => (
              <div key={album.id} className="group relative">
                <button
                  onClick={() => openAlbum(album)}
                  className="w-full flex flex-col items-start gap-1.5 p-3.5 rounded-md bg-paper border border-rule hover:border-rule-strong transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center mb-0.5">
                    <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-ink truncate w-full">{album.name}</p>
                  <p className="text-xs text-ink-faint tnum">{album.pinCount} {album.pinCount === 1 ? "story" : "stories"}</p>
                </button>
                {/* Delete button — appears on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album); }}
                  disabled={deletingId === album.id}
                  title="Delete collection"
                  className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-paper-sunken text-ink-faint hover:bg-[#9e4a3c]/15 hover:text-[#9e4a3c] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* New album inline creator */}
          {creatingAlbum && (
            <div className={`flex items-center gap-2 ${albums.length > 0 ? "mt-2" : ""}`}>
              <input
                autoFocus
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAlbum();
                  if (e.key === "Escape") { setCreatingAlbum(false); setNewAlbumName(""); }
                }}
                placeholder="Collection name…"
                maxLength={40}
                className="flex-1 text-sm px-3 py-2 rounded-md bg-paper border border-rule focus:outline-none focus:border-accent text-ink placeholder-ink-faint"
              />
              <button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || savingAlbum}
                className="shrink-0 px-3 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >
                {savingAlbum ? "…" : "Create"}
              </button>
              <button
                onClick={() => { setCreatingAlbum(false); setNewAlbumName(""); }}
                className="shrink-0 text-xs text-ink-faint hover:text-ink"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
