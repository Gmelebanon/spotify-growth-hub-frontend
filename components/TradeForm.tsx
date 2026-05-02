"use client";

import { useState } from "react";

export default function TradeForm({ onSave, onCancel }: any) {
  const [trackName, setTrackName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [playlistCount, setPlaylistCount] = useState(100);
  const [placements, setPlacements] = useState<string[]>([]);

  const handleSave = () => {
    onSave({
      track_name: trackName,
      artist_name: artistName,
      playlist_count: playlistCount,
      placements,
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Add Trade
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Track Name */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Track Name
          </label>
          <input
            type="text"
            placeholder="Track name..."
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
          />
        </div>

        {/* Artist Name */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Artist Name
          </label>
          <input
            type="text"
            placeholder="Artist name..."
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
          />
        </div>

        {/* Playlist Count */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Playlist Count
          </label>
          <input
            type="number"
            value={playlistCount}
            onChange={(e) => setPlaylistCount(Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-green-500"
          />
        </div>

        {/* Placements Box */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Placements
          </label>

          <div className="rounded-xl border border-zinc-800 bg-black p-2">
            <div className="scrollbar-spotify max-h-[120px] overflow-y-auto rounded-lg pr-1">
              {placements.length > 0 ? (
                <div className="space-y-1">
                  {placements.map((placement, index) => (
                    <div
                      key={`${placement}-${index}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                    >
                      <span>{placement}</span>
                      <button
                        onClick={() =>
                          setPlacements((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-zinc-500">
                  No placements yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-500"
        >
          Save
        </button>

        <button
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}