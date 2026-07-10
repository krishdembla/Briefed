"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAlbums,
  createAlbum,
  savePin,
  unsavePin,
  getPinAlbumIds,
  type PinAlbum,
} from "@/lib/db/saves";

interface AlbumPickerProps {
  pinId: string;
  userId: string;
  onClose: () => void;
  onSavedChange: (isSaved: boolean) => void;
}

export default function AlbumPicker({ pinId, userId, onClose, onSavedChange }: AlbumPickerProps) {
  const [albums, setAlbums] = useState<PinAlbum[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      let fetchedAlbums = await getAlbums(userId).catch(() => [] as PinAlbum[]);

      // Ensure user always has at least a "Reading List" to save into
      if (fetchedAlbums.length === 0) {
        const defaultAlbum = await createAlbum(userId, "Reading List").catch(() => null);
        if (defaultAlbum) fetchedAlbums = [defaultAlbum];
      }

      const checkedAlbumIds = await getPinAlbumIds(userId, pinId).catch(() => [] as string[]);

      setAlbums(fetchedAlbums);
      setCheckedIds(new Set(checkedAlbumIds));
      setLoading(false);
    }
    load();
  }, [userId, pinId]);

  // Focus the new-collection input when it appears
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  // Close when clicking outside the sheet
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  async function toggleAlbum(album: PinAlbum) {
    if (togglingId) return;
    setTogglingId(album.id);
    const isChecked = checkedIds.has(album.id);
    const next = new Set(checkedIds);

    try {
      if (isChecked) {
        await unsavePin(pinId, album.id);
        next.delete(album.id);
        setAlbums((prev) =>
          prev.map((a) => a.id === album.id ? { ...a, pinCount: Math.max(0, a.pinCount - 1) } : a)
        );
      } else {
        await savePin(userId, pinId, album.id);
        next.add(album.id);
        setAlbums((prev) =>
          prev.map((a) => a.id === album.id ? { ...a, pinCount: a.pinCount + 1 } : a)
        );
      }
      setCheckedIds(next);
      onSavedChange(next.size > 0);
    } catch (err) {
      console.error("[AlbumPicker] toggle failed:", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || savingNew) return;
    setSavingNew(true);
    try {
      const album = await createAlbum(userId, name);
      await savePin(userId, pinId, album.id);
      const withCount = { ...album, pinCount: 1 };
      setAlbums((prev) => [...prev, withCount]);
      const next = new Set(checkedIds).add(album.id);
      setCheckedIds(next);
      onSavedChange(true);
      setNewName("");
      setCreating(false);
    } catch (err) {
      console.error("[AlbumPicker] create failed:", err);
    } finally {
      setSavingNew(false);
    }
  }

  return (
    // Backdrop
    <div className="absolute inset-0 z-20 bg-ink/20">
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 bg-paper-raised rounded-t-2xl shadow-2xl border-t border-rule"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0.5">
          <div className="w-8 h-1 rounded-full bg-rule-strong" />
        </div>

        <div className="px-4 pt-2 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="font-serif text-lg text-ink">Save to collection</p>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-paper-sunken text-ink-soft hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-rule border-t-accent animate-spin" />
            </div>
          ) : (
            <>
              {/* Album grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-3 max-h-56 overflow-y-auto">
                {albums.map((album) => {
                  const isChecked = checkedIds.has(album.id);
                  const isToggling = togglingId === album.id;
                  return (
                    <button
                      key={album.id}
                      onClick={() => toggleAlbum(album)}
                      disabled={!!togglingId}
                      className={`relative flex flex-col items-start gap-1.5 p-3.5 rounded-md border text-left transition-all ${
                        isChecked
                          ? "bg-accent/8 border-accent/40"
                          : "bg-paper border-rule hover:border-rule-strong"
                      } disabled:opacity-60`}
                    >
                      {/* Bookmark icon */}
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-0.5 ${
                        isChecked ? "bg-accent/15" : "bg-paper-sunken"
                      }`}>
                        {isToggling ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-rule border-t-accent animate-spin" />
                        ) : (
                          <svg
                            className={`w-4 h-4 ${isChecked ? "text-accent" : "text-ink-faint"}`}
                            fill={isChecked ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-xs font-medium truncate w-full ${isChecked ? "text-accent" : "text-ink"}`}>
                        {album.name}
                      </p>
                      <p className="text-[10px] text-ink-faint tnum">
                        {album.pinCount} {album.pinCount === 1 ? "story" : "stories"}
                      </p>
                      {/* Checkmark badge */}
                      {isChecked && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* New collection creator */}
              {creating ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    placeholder="Collection name…"
                    maxLength={40}
                    className="flex-1 text-sm px-3 py-2 rounded-md border border-rule bg-paper text-ink focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || savingNew}
                    className="shrink-0 px-3 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors"
                  >
                    {savingNew ? "…" : "Create"}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(""); }}
                    className="shrink-0 text-xs text-ink-faint hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-md border border-dashed border-rule-strong hover:border-accent hover:bg-accent/5 transition-all text-sm font-medium text-ink-soft hover:text-accent"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New collection
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
