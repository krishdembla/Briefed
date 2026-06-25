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
    <div className="absolute inset-0 z-20 bg-black/20">
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0.5">
          <div className="w-8 h-1 rounded-full bg-zinc-200" />
        </div>

        <div className="px-4 pt-2 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-zinc-900">Save to collection</p>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-zinc-200 border-t-indigo-500 animate-spin" />
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
                      className={`relative flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left transition-all ${
                        isChecked
                          ? "bg-indigo-50 border-indigo-300"
                          : "bg-zinc-50 border-zinc-200 hover:border-zinc-400"
                      } disabled:opacity-60`}
                    >
                      {/* Bookmark icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-0.5 ${
                        isChecked ? "bg-indigo-100" : "bg-zinc-200"
                      }`}>
                        {isToggling ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-300 border-t-indigo-500 animate-spin" />
                        ) : (
                          <svg
                            className={`w-4 h-4 ${isChecked ? "text-indigo-600" : "text-zinc-500"}`}
                            fill={isChecked ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-xs font-semibold truncate w-full ${isChecked ? "text-indigo-700" : "text-zinc-800"}`}>
                        {album.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {album.pinCount} {album.pinCount === 1 ? "story" : "stories"}
                      </p>
                      {/* Checkmark badge */}
                      {isChecked && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
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
                    className="flex-1 text-sm px-3 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || savingNew}
                    className="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    {savingNew ? "…" : "Create"}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(""); }}
                    className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-dashed border-zinc-300 hover:border-indigo-400 hover:bg-indigo-50/60 transition-all text-sm font-medium text-zinc-500 hover:text-indigo-600"
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
