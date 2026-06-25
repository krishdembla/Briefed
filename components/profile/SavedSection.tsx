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
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <button
            onClick={() => setActiveAlbum(null)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{activeAlbum.name}</p>
            <p className="text-xs text-zinc-500">{activeAlbum.pinCount} saved</p>
          </div>
        </div>

        {/* Pins list */}
        <div className="divide-y divide-zinc-800/60">
          {loadingPins && (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 rounded-full border-2 border-zinc-700 border-t-indigo-400 animate-spin" />
            </div>
          )}
          {!loadingPins && albumPins.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-600">
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
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: color + "20", color }}
                    >
                      {label}
                    </span>
                    {p.region_label && (
                      <span className="text-[10px] text-zinc-600 truncate">{p.region_label}</span>
                    )}
                    <span className="text-[10px] text-zinc-700 ml-auto shrink-0">{timeAgo(entry.savedAt)}</span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-snug line-clamp-2 mb-1">{p.headline}</p>
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-600 hover:text-indigo-400 underline underline-offset-2 transition-colors"
                  >
                    {p.source_name}
                  </a>
                </div>
                <button
                  onClick={() => handleRemovePin(entry)}
                  title="Remove from collection"
                  className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-zinc-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Saved</p>
          <p className="text-xs text-zinc-600 mt-0.5">Your reading collections</p>
        </div>
        {!creatingAlbum && (
          <button
            onClick={() => setCreatingAlbum(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-white transition-colors"
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
          <div className="w-4 h-4 rounded-full border-2 border-zinc-700 border-t-indigo-400 animate-spin" />
        </div>
      ) : (
        <>
          {albums.length === 0 && !creatingAlbum && (
            <div className="text-center py-6">
              <p className="text-sm text-zinc-600 mb-3">No collections yet.</p>
              <p className="text-xs text-zinc-700">Tap the bookmark icon on any story to save it.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {albums.map((album) => (
              <div key={album.id} className="group relative">
                <button
                  onClick={() => openAlbum(album)}
                  className="w-full flex flex-col items-start gap-1.5 p-3.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-500 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-0.5">
                    <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white truncate w-full">{album.name}</p>
                  <p className="text-xs text-zinc-500">{album.pinCount} {album.pinCount === 1 ? "story" : "stories"}</p>
                </button>
                {/* Delete button — appears on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album); }}
                  disabled={deletingId === album.id}
                  title="Delete collection"
                  className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-zinc-700 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
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
                className="flex-1 text-sm px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-600 focus:outline-none focus:border-indigo-500 text-white placeholder-zinc-600"
              />
              <button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || savingAlbum}
                className="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors"
              >
                {savingAlbum ? "…" : "Create"}
              </button>
              <button
                onClick={() => { setCreatingAlbum(false); setNewAlbumName(""); }}
                className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
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
