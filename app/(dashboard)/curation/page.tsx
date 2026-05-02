"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getAccounts } from "@/lib/api/accounts";
import { type CurationTrack as ApiCurationTrack } from "@/lib/api/curation";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type CurationTrack = ApiCurationTrack & {
  id: string;
  title: string;
  artist: string;
  spotify_id?: string | null;
};

type AccountItem = {
  id: number;
  display_name?: string;
};

type ImportedLinkWithId = {
  id: string;
  display_name: string;
  link: string;
  source_type: string;
  track_count: number;
  accountName?: string;
  tracks: CurationTrack[];
};

type SavedCuration = {
  id: string;
  name: string;
  tracks: CurationTrack[];
  trackCount: number;
  createdAt: string;
};

type SavedMasterPlaylist = {
  id: string;
  name: string;
  tracks?: number;
  createdAt?: string;
};

type DuplicateGroup = {
  id: string;
  normalizedTitle: string;
  tracks: CurationTrack[];
  originalIndexes: number[];
  riskType: "exact" | "similar";
};

type SpaceApartModes = Record<string, "10" | "20" | "custom">;
type SpaceApartSettings = Record<string, number>;

const DUPLICATE_SPACE_KEY = "__all_duplicate_groups__";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const LINK_COLORS = [
  "bg-green-400",
  "bg-sky-400",
  "bg-fuchsia-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-cyan-400",
  "bg-violet-400",
  "bg-emerald-400",
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeImportedLinkId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function savedCurationsStorageKey(accountId: number | null) {
  return `nerd-engine-saved-curations-${accountId ?? "none"}`;
}

function trackKey(track: CurationTrack) {
  return `${track.title.toLowerCase()}__${track.artist.toLowerCase()}`;
}

function trackIdentity(track: CurationTrack) {
  return `${track.id}__${track.title}__${track.artist}`;
}

function formatTrackLine(track: CurationTrack) {
  return `${track.title} - ${track.artist}`;
}

function getColorClass(index: number) {
  return LINK_COLORS[index % LINK_COLORS.length];
}

function ensureImportedLinkIds(
  items: ImportedLinkWithId[],
): ImportedLinkWithId[] {
  const seen = new Set<string>();

  return items.map((item, index) => {
    const candidate = "id" in item && typeof item.id === "string" ? item.id : "";
    let id = candidate || `${makeImportedLinkId()}-${index}`;

    while (seen.has(id)) {
      id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    }

    seen.add(id);

    return {
      ...item,
      id,
    };
  });
}

function normalizeImportedTrack(row: any, index: number): CurationTrack {
  const spotifyId =
    typeof row?.spotify_id === "string"
      ? row.spotify_id
      : typeof row?.track_id === "string"
        ? row.track_id
        : typeof row?.id === "string"
          ? row.id
          : null;

  return {
    id: spotifyId || `imported-track-${index}-${Date.now()}`,
    spotify_id: spotifyId,
    title:
      typeof row?.title === "string"
        ? row.title
        : typeof row?.name === "string"
          ? row.name
          : "Untitled Track",
    artist:
      typeof row?.artist === "string"
        ? row.artist
        : typeof row?.artist_name === "string"
          ? row.artist_name
          : "Unknown Artist",
  };
}

function normalizeImportedLinkPayload({
  playlist,
  tracksPayload,
  url,
  accountName,
}: {
  playlist: any;
  tracksPayload: any;
  url: string;
  accountName: string;
}): ImportedLinkWithId {
  const rawTracks = Array.isArray(tracksPayload)
    ? tracksPayload
    : Array.isArray(tracksPayload?.items)
      ? tracksPayload.items
      : Array.isArray(tracksPayload?.tracks)
        ? tracksPayload.tracks
        : [];

  const tracks = rawTracks.map((track: any, index: number) =>
    normalizeImportedTrack(track, index),
  );

  return {
    id: makeImportedLinkId(),
    link: url,
    display_name:
      playlist?.name ||
      playlist?.title ||
      playlist?.playlist_name ||
      "Imported Playlist",
    accountName,
    source_type: "playlist",
    track_count: tracks.length,
    tracks,
  };
}

async function importSpotifyLinkFromAccount(
  accountId: number,
  accountName: string,
  url: string,
): Promise<ImportedLinkWithId> {
  if (!accountId || accountId <= 0) {
    throw new Error("Invalid account ID.");
  }

  const playlistIdMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
  const spotifyPlaylistId = playlistIdMatch?.[1];

  if (!spotifyPlaylistId) {
    throw new Error("Paste a valid Spotify playlist link.");
  }

  const playlistsResponse = await fetch(
    `${API_BASE_URL}/api/accounts/${accountId}/playlists`,
  );

  if (!playlistsResponse.ok) {
    throw new Error(`Failed to read playlists from ${accountName}.`);
  }

  const playlistsPayload = await playlistsResponse.json();
  const playlists = Array.isArray(playlistsPayload)
    ? playlistsPayload
    : playlistsPayload.items || playlistsPayload.playlists || [];

  const playlist = playlists.find((item: any) => {
    return (
      item.spotify_id === spotifyPlaylistId ||
      item.spotify_playlist_id === spotifyPlaylistId ||
      item.spotify_url?.includes(spotifyPlaylistId)
    );
  });

  if (!playlist?.id) {
    throw new Error(`Playlist not found in ${accountName}.`);
  }

  const tracksResponse = await fetch(
    `${API_BASE_URL}/api/accounts/${accountId}/playlists/${playlist.id}/tracks`,
  );

  if (!tracksResponse.ok) {
    throw new Error(`Failed to import tracks from ${accountName}.`);
  }

  const tracksPayload = await tracksResponse.json();

  return normalizeImportedLinkPayload({
    playlist,
    tracksPayload,
    url,
    accountName,
  });
}

async function importSpotifyLinkAllAccounts(
  accounts: AccountItem[],
  url: string,
): Promise<ImportedLinkWithId> {
  const realAccounts = accounts.filter((account) => account.id > 0);

  if (realAccounts.length === 0) {
    throw new Error("No Spotify accounts found.");
  }

  let lastError = "Playlist not found in any account.";

  for (const account of realAccounts) {
    try {
      const imported = await importSpotifyLinkFromAccount(
        account.id,
        account.display_name || `Account ${account.id}`,
        url,
      );

      if (imported.tracks.length > 0) {
        return imported;
      }

      lastError = `No tracks found in ${account.display_name || `Account ${account.id}`}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Import failed.";
    }
  }

  throw new Error(lastError);
}

function parseTypedTracks(raw: string): CurationTrack[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [titlePart, ...artistParts] = line.split(" - ");
      const title = titlePart?.trim() || "Untitled Track";
      const artist = artistParts.join(" - ").trim() || "Unknown Artist";

      return {
        id: `typed-${title}-${artist}-${index}`,
        title,
        artist,
      };
    });
}

function buildMergedTracks(
  typedTracks: CurationTrack[],
  importedLinks: ImportedLinkWithId[],
): CurationTrack[] {
  return [...typedTracks, ...importedLinks.flatMap((item) => item.tracks)];
}

function removeTrackFromTextarea(raw: string, track: CurationTrack) {
  const target = formatTrackLine(track).toLowerCase();

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase() !== target)
    .join("\n");
}

function removeTrackFromImportedLinks(
  importedLinks: ImportedLinkWithId[],
  track: CurationTrack,
): ImportedLinkWithId[] {
  const target = trackKey(track);

  return importedLinks
    .map((item) => {
      const nextTracks = item.tracks.filter((entry) => trackKey(entry) !== target);

      return {
        ...item,
        tracks: nextTracks,
        track_count: nextTracks.length,
      };
    })
    .filter((item) => item.tracks.length > 0);
}

function normalizeTitleForGroup(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/feat\..*$/g, "")
    .replace(/ft\..*$/g, "")
    .replace(/-.*$/g, "")
    .replace(
      /\b(pop version|version|remix|edit|radio edit|extended|acoustic|live|dual op|dual|op|sped up|slow|reverb|slowed|nightcore|cover|karaoke|instrumental|techno version|techno mix|afro house version|with sam smith|alok remix)\b/g,
      "",
    )
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupDuplicateTracks(tracks: CurationTrack[]): DuplicateGroup[] {
  const map = new Map<
    string,
    {
      tracksByIdentity: Map<string, CurationTrack>;
      originalIndexes: number[];
      exactTitles: Set<string>;
      artists: Set<string>;
    }
  >();

  tracks.forEach((track, index) => {
    const normalizedTitle = normalizeTitleForGroup(track.title);
    if (!normalizedTitle) return;

    const current =
      map.get(normalizedTitle) ??
      {
        tracksByIdentity: new Map<string, CurationTrack>(),
        originalIndexes: [],
        exactTitles: new Set<string>(),
        artists: new Set<string>(),
      };

    const identity = trackIdentity(track);

    if (!current.tracksByIdentity.has(identity)) {
      current.tracksByIdentity.set(identity, track);
      current.originalIndexes.push(index);
    }

    current.exactTitles.add(track.title.toLowerCase().trim());
    current.artists.add(track.artist.toLowerCase().trim());

    map.set(normalizedTitle, current);
  });

  return Array.from(map.entries())
    .map(([normalizedTitle, group]) => {
      const uniqueTracks = Array.from(group.tracksByIdentity.values());

      return {
        id: `duplicate-group-${normalizedTitle}`,
        normalizedTitle,
        tracks: uniqueTracks,
        originalIndexes: group.originalIndexes,
        riskType:
          group.exactTitles.size === 1 && group.artists.size > 1 ? "exact" : "similar",
      } satisfies DuplicateGroup;
    })
    .filter((group) => group.tracks.length > 1);
}

function findTrackIndexByIdentity(tracks: CurationTrack[], target: CurationTrack) {
  const targetIdentity = trackIdentity(target);
  return tracks.findIndex((track) => trackIdentity(track) === targetIdentity);
}

function enforceGroupSpacing(
  input: CurationTrack[],
  groups: DuplicateGroup[],
  spaceApartSettings: SpaceApartSettings,
) {
  const output = [...input];
  const spacing = Math.max(
    0,
    Number(spaceApartSettings[DUPLICATE_SPACE_KEY] ?? 10) || 10,
  );

  groups.forEach((group) => {
    const baseTrack = group.tracks[0];
    let baseIndex = findTrackIndexByIdentity(output, baseTrack);

    if (baseIndex === -1) return;

    group.tracks.slice(1).forEach((track, groupIndex) => {
      const currentIndex = findTrackIndexByIdentity(output, track);
      if (currentIndex === -1) return;

      const targetIndex = Math.min(
        output.length - 1,
        baseIndex + spacing * (groupIndex + 1),
      );

      if (currentIndex === targetIndex) return;

      const [moved] = output.splice(currentIndex, 1);
      output.splice(Math.min(targetIndex, output.length), 0, moved);

      baseIndex = findTrackIndexByIdentity(output, baseTrack);
    });
  });

  return output;
}

function TrackDots({ colorIndexes }: { colorIndexes: number[] }) {
  if (colorIndexes.length === 0) return null;

  return (
    <div className="mr-3 flex shrink-0 items-center gap-1.5">
      {colorIndexes.map((index, dotIndex) => (
        <span
          key={`${index}-${dotIndex}`}
          className={`h-2.5 w-2.5 rounded-full ${getColorClass(index)}`}
        />
      ))}
    </div>
  );
}

function SideSection({
  title,
  tracks,
  linkInput,
  setLinkInput,
  importMutation,
  importedLinks,
  setImportedLinks,
  clearSide,
  removeTrack,
}: {
  title: string;
  tracks: CurationTrack[];
  linkInput: string;
  setLinkInput: (value: string) => void;
  importMutation: any;
  importedLinks: ImportedLinkWithId[];
  setImportedLinks: Dispatch<SetStateAction<ImportedLinkWithId[]>>;
  clearSide: () => void;
  removeTrack: (track: CurationTrack) => void;
}) {
  const trackColorMap = useMemo(() => {
    const map = new Map<string, number[]>();

    importedLinks.forEach((item, itemIndex) => {
      item.tracks.forEach((track) => {
        const key = trackKey(track);
        const existing = map.get(key) ?? [];
        map.set(key, [...existing, itemIndex]);
      });
    });

    return map;
  }, [importedLinks]);

  return (
    <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(39,39,42,0.35),rgba(9,9,11,0.9))] p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <div className="mt-2 text-[20px] font-semibold text-white">
            {tracks.length} tracks
          </div>
        </div>

        <button
          onClick={clearSide}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900"
        >
          Clear
        </button>
      </div>

      <div className="flex gap-3">
        <input
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          placeholder="Paste Spotify playlist or album link"
          className="h-12 flex-1 rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
        />

        <button
          onClick={() => importMutation.mutate(linkInput)}
          disabled={!linkInput.trim() || importMutation.isPending}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-green-600 px-5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importMutation.isPending ? "Importing..." : "Import"}
        </button>
      </div>

      {importMutation.error instanceof Error ? (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {importMutation.error.message}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
        <div className="mb-3 text-sm font-semibold text-white">Imported Links</div>

        {importedLinks.length === 0 ? (
          <div className="text-sm text-zinc-500">No imported links yet.</div>
        ) : (
          <div className="space-y-3">
            {importedLinks.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${getColorClass(index)}`}
                      />
                      <div className="truncate text-sm font-semibold text-white">
                        {item.display_name || "Imported Playlist"}
                      </div>
                    </div>

                    <div className="mt-1 truncate text-xs text-zinc-500">
                      {item.accountName || "Unknown Account"}
                    </div>

                    <div className="mt-2 truncate text-xs text-zinc-400">
                      {item.track_count} tracks - {item.source_type}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setImportedLinks((prev) =>
                        prev.filter((entry) => entry.id !== item.id),
                      )
                    }
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
        <div className="mb-3 text-sm font-semibold text-white">Tracks In List</div>

        {tracks.length === 0 ? (
          <div className="text-sm text-zinc-500">No tracks in this list yet.</div>
        ) : (
          <div className="scrollbar-spotify max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {tracks.map((track, index) => {
              const colorIndexes = trackColorMap.get(trackKey(track)) ?? [];

              return (
                <div
                  key={`${track.id}-${trackKey(track)}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center">
                    <TrackDots colorIndexes={colorIndexes} />
                    <div className="min-w-0 text-sm text-zinc-300">
                      {formatTrackLine(track)}
                    </div>
                  </div>

                  <button
                    onClick={() => removeTrack(track)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    X
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DuplicateGroupCard({
  group,
  displayedTracks,
  spaceApartModes,
  spaceApartSettings,
  setSpaceApartModes,
  setSpaceApartSettings,
  deleteTrackFromResult,
}: {
  group: DuplicateGroup;
  displayedTracks: CurationTrack[];
  spaceApartModes: SpaceApartModes;
  spaceApartSettings: SpaceApartSettings;
  setSpaceApartModes: Dispatch<SetStateAction<SpaceApartModes>>;
  setSpaceApartSettings: Dispatch<SetStateAction<SpaceApartSettings>>;
  deleteTrackFromResult: (track: CurationTrack) => void;
}) {
  const mode = spaceApartModes[DUPLICATE_SPACE_KEY] ?? "10";
  const target = spaceApartSettings[DUPLICATE_SPACE_KEY] ?? 10;

  const setPreset = (preset: "10" | "20") => {
    setSpaceApartModes((prev) => ({
      ...prev,
      [DUPLICATE_SPACE_KEY]: preset,
    }));

    setSpaceApartSettings((prev) => ({
      ...prev,
      [DUPLICATE_SPACE_KEY]: Number(preset),
    }));
  };

  const setCustom = (value: string) => {
    setSpaceApartModes((prev) => ({
      ...prev,
      [DUPLICATE_SPACE_KEY]: "custom",
    }));

    setSpaceApartSettings((prev) => ({
      ...prev,
      [DUPLICATE_SPACE_KEY]: Math.max(0, Number(value) || 0),
    }));
  };

  return (
    <div className="rounded-2xl border border-green-500/40 bg-black p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-green-400">
        {group.riskType === "exact"
          ? `DUPLICATE GROUP - EXACT TITLE (${group.tracks.length})`
          : `DUPLICATE GROUP - SIMILAR TITLE (${group.tracks.length})`}
      </div>

      <div className="space-y-2">
        {group.tracks.map((track) => {
          const calculatedIndex = findTrackIndexByIdentity(displayedTracks, track);
          const displayNumber = calculatedIndex >= 0 ? calculatedIndex + 1 : "?";

          return (
            <div
              key={trackIdentity(track)}
              className="flex items-center justify-between rounded-xl border border-green-500/35 bg-black px-4 py-3"
            >
              <div className="flex min-w-0 items-center text-sm text-zinc-200">
                <span className="mr-3 h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                <span className="truncate">
                  #{displayNumber} {formatTrackLine(track)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => deleteTrackFromResult(track)}
                className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-green-500/40 bg-black text-xs font-semibold text-green-300 transition hover:bg-green-500/10"
              >
                X
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
        <span className="mr-2">Space Apart</span>

        <button
          type="button"
          onClick={() => setPreset("10")}
          className={`rounded-lg border px-3 py-2 font-semibold ${
            mode === "10"
              ? "border-green-500 bg-green-600 text-white"
              : "border-zinc-800 bg-black text-zinc-300"
          }`}
        >
          10
        </button>

        <button
          type="button"
          onClick={() => setPreset("20")}
          className={`rounded-lg border px-3 py-2 font-semibold ${
            mode === "20"
              ? "border-green-500 bg-green-600 text-white"
              : "border-zinc-800 bg-black text-zinc-300"
          }`}
        >
          20
        </button>

        <input
          value={target}
          onChange={(e) => setCustom(e.target.value)}
          className="h-9 w-[70px] rounded-lg border border-zinc-800 bg-black px-3 text-xs font-semibold text-white outline-none focus:border-green-500"
        />
      </div>
    </div>
  );
}

function SavedCurationsCard({
  savedCurations,
  selectedCurationId,
  curationName,
  setCurationName,
  saveCuration,
  updateCuration,
  loadCuration,
  deleteCuration,
  canSave,
}: {
  savedCurations: SavedCuration[];
  selectedCurationId: string;
  curationName: string;
  setCurationName: (value: string) => void;
  saveCuration: () => void;
  updateCuration: () => void;
  loadCuration: (id: string) => void;
  deleteCuration: (id: string) => void;
  canSave: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-2xl font-semibold text-white">Saved Curations</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Save only the final curation result and load it later.
          </p>
        </div>

        <span className="text-sm font-semibold text-zinc-400">{open ? "-" : "+"}</span>
      </button>

      {open ? (
        <>
          <div className="mt-5 flex gap-3">
            <input
              value={curationName}
              onChange={(e) => setCurationName(e.target.value)}
              placeholder="Curation name..."
              className="h-12 flex-1 rounded-xl border border-zinc-800 bg-black px-4 text-white placeholder:text-zinc-500 outline-none focus:border-green-500"
            />

            <button
              onClick={saveCuration}
              disabled={!canSave}
              className="h-12 rounded-xl bg-green-600 px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save Curation
            </button>

            <button
              onClick={updateCuration}
              disabled={!selectedCurationId || !canSave}
              className="h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {savedCurations.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-500">
                No saved curations yet.
              </div>
            ) : (
              savedCurations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-black px-4 py-4"
                >
                  <div className="text-sm font-semibold text-white">{item.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {item.trackCount} tracks
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => loadCuration(item.id)}
                      className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300"
                    >
                      Load
                    </button>

                    <button
                      onClick={() => deleteCuration(item.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
function ResultDot({ colorClass }: { colorClass: string }) {
  return (
    <span
      className={`mr-3 h-2.5 w-2.5 shrink-0 rounded-full ${colorClass}`}
    />
  );
}
function loadSavedMasterPlaylists(): SavedMasterPlaylist[] {
  try {
    const raw =
      window.localStorage.getItem("master_playlists") ||
      window.localStorage.getItem("nerd-engine-playlist-manager-global");

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.savedMasterPlaylists)) {
      return parsed.savedMasterPlaylists;
    }

    return [];
  } catch {
    return [];
  }
}

export default function CurationPage() {
  const router = useRouter();
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);

  const [sourceText, setSourceText] = useState("");
  const [myTracksText, setMyTracksText] = useState("");
  const [sourceLinkInput, setSourceLinkInput] = useState("");
  const [myTracksLinkInput, setMyTracksLinkInput] = useState("");
  const [sourceImportedLinks, setSourceImportedLinks] = useState<ImportedLinkWithId[]>([]);
  const [myImportedLinks, setMyImportedLinks] = useState<ImportedLinkWithId[]>([]);

  const [sourceRatio, setSourceRatio] = useState("3");
  const [myRatio, setMyRatio] = useState("1");
  const [leadsCount, setLeadsCount] = useState("15");

  const [curationName, setCurationName] = useState("");
  const [savedCurations, setSavedCurations] = useState<SavedCuration[]>([]);
  const [selectedCurationId, setSelectedCurationId] = useState("");
  const [curationBaseResult, setCurationBaseResult] = useState<CurationTrack[]>([]);
  const [spaceApartSettings, setSpaceApartSettings] = useState<SpaceApartSettings>({});
  const [spaceApartModes, setSpaceApartModes] = useState<SpaceApartModes>({});
  const [selectedMasterPlaylistId, setSelectedMasterPlaylistId] = useState("");
  const [savedMasterPlaylists, setSavedMasterPlaylists] = useState<SavedMasterPlaylist[]>([]);
  const [sendStatus, setSendStatus] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const accountsQuery = useQuery<AccountItem[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    retry: false,
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  useEffect(() => {
    if (!activeAccountId) {
      setSavedCurations([]);
      setSelectedCurationId("");
      return;
    }

    try {
      const raw = window.localStorage.getItem(savedCurationsStorageKey(activeAccountId));
      setSavedCurations(raw ? JSON.parse(raw) : []);
      setSelectedCurationId("");
    } catch {
      setSavedCurations([]);
      setSelectedCurationId("");
    }
  }, [activeAccountId]);

  useEffect(() => {
    const refreshSavedMasters = () => {
      const items = loadSavedMasterPlaylists();
      setSavedMasterPlaylists(items);

      if (items.length > 0 && !selectedMasterPlaylistId) {
        setSelectedMasterPlaylistId(items[0].id);
      }
    };

    refreshSavedMasters();

    window.addEventListener("storage", refreshSavedMasters);

    return () => {
      window.removeEventListener("storage", refreshSavedMasters);
    };
  }, [selectedMasterPlaylistId]);

  const persistSavedCurations = (next: SavedCuration[]) => {
    setSavedCurations(next);

    if (activeAccountId) {
      window.localStorage.setItem(
        savedCurationsStorageKey(activeAccountId),
        JSON.stringify(next),
      );
    }
  };

  const sourceTracks = useMemo(
    () => buildMergedTracks(parseTypedTracks(sourceText), sourceImportedLinks),
    [sourceText, sourceImportedLinks],
  );

  const myTracks = useMemo(
    () => buildMergedTracks(parseTypedTracks(myTracksText), myImportedLinks),
    [myTracksText, myImportedLinks],
  );

  const sourceTrackKeys = useMemo(
    () => new Set(sourceTracks.map((track) => trackKey(track))),
    [sourceTracks],
  );

  const myTrackKeys = useMemo(
    () => new Set(myTracks.map((track) => trackKey(track))),
    [myTracks],
  );

  const duplicateGroups = useMemo(
    () => groupDuplicateTracks(curationBaseResult),
    [curationBaseResult],
  );

  const displayedCurationResult = useMemo(
    () => enforceGroupSpacing(curationBaseResult, duplicateGroups, spaceApartSettings),
    [curationBaseResult, duplicateGroups, spaceApartSettings],
  );

  const duplicateTrackKeys = useMemo(() => {
    const keys = new Set<string>();

    duplicateGroups.forEach((group) => {
      group.tracks.forEach((track) => keys.add(trackKey(track)));
    });

    return keys;
  }, [duplicateGroups]);

  const sourceImportMutation = useMutation({
    mutationFn: (link: string) => importSpotifyLinkAllAccounts(accounts, link),
    onSuccess: (payload) => {
      setSourceImportedLinks((prev) => ensureImportedLinkIds([...prev, payload]));
      setSourceLinkInput("");
    },
  });

  const myTracksImportMutation = useMutation({
    mutationFn: (link: string) => importSpotifyLinkAllAccounts(accounts, link),
    onSuccess: (payload) => {
      setMyImportedLinks((prev) => ensureImportedLinkIds([...prev, payload]));
      setMyTracksLinkInput("");
    },
  });

  const clearSourceOnly = () => {
    setSourceText("");
    setSourceImportedLinks([]);
  };

  const clearMyTracksOnly = () => {
    setMyTracksText("");
    setMyImportedLinks([]);
  };

  const removeTrackFromSource = (track: CurationTrack) => {
    setSourceText((prev) => removeTrackFromTextarea(prev, track));
    setSourceImportedLinks((prev) => removeTrackFromImportedLinks(prev, track));
  };

  const removeTrackFromMyTracks = (track: CurationTrack) => {
    setMyTracksText((prev) => removeTrackFromTextarea(prev, track));
    setMyImportedLinks((prev) => removeTrackFromImportedLinks(prev, track));
  };

  const deleteTrackFromResult = (trackToDelete: CurationTrack) => {
    const targetIdentity = trackIdentity(trackToDelete);

    setCurationBaseResult((prev) =>
      prev.filter((track) => trackIdentity(track) !== targetIdentity),
    );
  };

  const runCuration = () => {
    const leads = Math.max(0, Number(leadsCount) || 0);
    const sourceCount = Math.max(1, Number(sourceRatio) || 1);
    const myCount = Math.max(1, Number(myRatio) || 1);

    const sourceQueue = [...sourceTracks];
    const myQueue = [...myTracks];
    const output: CurationTrack[] = [];

    while (output.length < leads && sourceQueue.length > 0) {
      output.push(sourceQueue.shift() as CurationTrack);
    }

    while (sourceQueue.length > 0 || myQueue.length > 0) {
      for (let i = 0; i < sourceCount && sourceQueue.length > 0; i += 1) {
        output.push(sourceQueue.shift() as CurationTrack);
      }

      for (let i = 0; i < myCount && myQueue.length > 0; i += 1) {
        output.push(myQueue.shift() as CurationTrack);
      }

      if (sourceQueue.length === 0 && myQueue.length === 0) break;
    }

    const groups = groupDuplicateTracks(output);
    const nextModes: SpaceApartModes = {};
    const nextSettings: SpaceApartSettings = {};

    nextModes[DUPLICATE_SPACE_KEY] =
      spaceApartModes[DUPLICATE_SPACE_KEY] ?? "10";
    nextSettings[DUPLICATE_SPACE_KEY] =
      spaceApartSettings[DUPLICATE_SPACE_KEY] ?? 10;

    setSpaceApartModes(nextModes);
    setSpaceApartSettings(nextSettings);
    setCurationBaseResult(output);
  };

 const saveCuration = () => {
  if (curationBaseResult.length === 0) {
    setSendStatus("Run curation first before saving.");
    return;
  }

  const name = window.prompt("Save curation name");
  if (!name?.trim()) return;

  const newSavedCuration = {
    id: `saved-${Date.now()}`,
    name: name.trim(),
    tracks: curationBaseResult,
    createdAt: new Date().toISOString(),
  };

  const existing = JSON.parse(
    window.localStorage.getItem("saved-curations") || "[]",
  );

  const updated = [newSavedCuration, ...existing];

  window.localStorage.setItem("saved-curations", JSON.stringify(updated));
  setSavedCurations(updated);
  setSelectedCurationId(newSavedCuration.id);
  setSendStatus("Curation saved.");
};

  const updateCuration = () => {
    if (!selectedCurationId || displayedCurationResult.length === 0) return;

    let name = curationName.trim();

    if (!name) {
      const requestedName = window.prompt("Enter curation name");
      name = requestedName?.trim() || "";
    }

    if (!name) return;

    const next = savedCurations.map((curation) =>
      curation.id === selectedCurationId
        ? {
            ...curation,
            name,
            tracks: displayedCurationResult,
            trackCount: displayedCurationResult.length,
            createdAt: new Date().toISOString(),
          }
        : curation,
    );

    persistSavedCurations(next);
    setCurationName(name);
  };

  const loadCuration = (id: string) => {
    const found = savedCurations.find((item) => item.id === id);
    if (!found) return;

    setSelectedCurationId(id);
    setCurationName(found.name);
    setCurationBaseResult(found.tracks);
    setSpaceApartSettings({});
    setSpaceApartModes({});
  };

  const deleteCuration = (id: string) => {
    const next = savedCurations.filter((item) => item.id !== id);
    persistSavedCurations(next);

    if (selectedCurationId === id) {
      setSelectedCurationId("");
      setCurationName("");
    }
  };

  const sendToPlaylistManager = () => {
    if (displayedCurationResult.length === 0) {
      setSendStatus("Run curation first.");
      return;
    }

    const selectedMasterPlaylist =
      savedMasterPlaylists.find((item) => item.id === selectedMasterPlaylistId) ?? null;

    window.localStorage.setItem(
      "nerd-engine-playlist-manager-curation-draft",
      JSON.stringify({
        created_at: new Date().toISOString(),
        account_id: activeAccountId,
        active_account_name: activeAccount?.display_name || null,
        curation_name: curationName.trim() || "Curation Draft",
        target: selectedMasterPlaylistId || null,
        target_master_playlist_id: selectedMasterPlaylistId || null,
        target_master_playlist_name: selectedMasterPlaylist?.name || null,
        tracks: displayedCurationResult,
        duplicate_groups: duplicateGroups,
        space_apart_settings: spaceApartSettings,
      }),
    );

    router.push("/playlist-manager");
  };

  const previewSummary = useMemo(() => {
    if (!previewOpen) return null;

    return {
      leads: Math.max(0, Number(leadsCount) || 0),
      sourceRatio: Math.max(1, Number(sourceRatio) || 1),
      myRatio: Math.max(1, Number(myRatio) || 1),
      totalTracks: displayedCurationResult.length,
      duplicatesCount: duplicateGroups.length,
    };
  }, [
    previewOpen,
    leadsCount,
    sourceRatio,
    myRatio,
    displayedCurationResult.length,
    duplicateGroups.length,
  ]);

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Curation Engine</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Build your final sequence by mixing source playlist tracks with your own track pool.
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Active Account: All Accounts
          </p>
        </div>

        <div className="w-full max-w-[320px]">
          <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
            Saved Curation
          </label>

          <select
            value={selectedCurationId}
            onChange={(e) => loadCuration(e.target.value)}
            className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-green-500"
          >
            <option value="">Select saved curation</option>
            {savedCurations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SideSection
            title="Source Playlist Tracks"
            tracks={sourceTracks}
            linkInput={sourceLinkInput}
            setLinkInput={setSourceLinkInput}
            importMutation={sourceImportMutation}
            importedLinks={sourceImportedLinks}
            setImportedLinks={setSourceImportedLinks}
            clearSide={clearSourceOnly}
            removeTrack={removeTrackFromSource}
          />

          <SideSection
            title="My Tracks"
            tracks={myTracks}
            linkInput={myTracksLinkInput}
            setLinkInput={setMyTracksLinkInput}
            importMutation={myTracksImportMutation}
            importedLinks={myImportedLinks}
            setImportedLinks={setMyImportedLinks}
            clearSide={clearMyTracksOnly}
            removeTrack={removeTrackFromMyTracks}
          />
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-end">
          <div className="flex gap-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">Source Ratio</label>
              <input
                value={sourceRatio}
                onChange={(e) => setSourceRatio(e.target.value)}
                className="h-11 w-[90px] rounded-xl border border-zinc-800 bg-black px-4 text-white outline-none transition focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">My Ratio</label>
              <input
                value={myRatio}
                onChange={(e) => setMyRatio(e.target.value)}
                className="h-11 w-[90px] rounded-xl border border-zinc-800 bg-black px-4 text-white outline-none transition focus:border-green-500"
              />
            </div>
          </div>

          <button
            onClick={runCuration}
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-green-600 px-8 text-base font-semibold text-white transition hover:bg-green-500"
          >
            Run Curation
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-4">
          <div className="mb-3 text-sm font-semibold text-white">Curation Result</div>

          {displayedCurationResult.length === 0 ? (
            <div className="text-sm text-zinc-500">Run curation to generate a result.</div>
          ) : (
            <div className="scrollbar-spotify max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {displayedCurationResult.map((track, index) => {
                const key = trackKey(track);
                const isSource = sourceTrackKeys.has(key);
                const isMine = myTrackKeys.has(key);
                const isDuplicate = duplicateTrackKeys.has(key);

                const dotClass = isDuplicate
                  ? "bg-green-400"
                  : isSource
                    ? "bg-red-400"
                    : isMine
                      ? "bg-yellow-300"
                      : "bg-zinc-400";

                const borderClass = isDuplicate
                  ? "border-green-500/40"
                  : isSource
                    ? "border-red-500/20"
                    : isMine
                      ? "border-yellow-500/20"
                      : "border-zinc-800";

                return (
                  <div
                    key={`${trackIdentity(track)}-${index}`}
                    className={`flex items-center justify-between rounded-xl border bg-zinc-950 px-4 py-3 ${borderClass}`}
                  >
                    <div className="flex min-w-0 items-center">
                      <ResultDot colorClass={dotClass} />
                      <div className="min-w-0 text-sm text-zinc-300">
                        {index + 1}. {formatTrackLine(track)}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTrackFromResult(track)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300"
                    >
                      X
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {duplicateGroups.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-green-500/30 bg-black p-4">
            <div className="mb-4 text-sm font-semibold text-green-400">
              Duplicate Risk ({duplicateGroups.length})
            </div>

            <div className="space-y-4">
              {duplicateGroups.map((group) => (
                <DuplicateGroupCard
                  key={group.id}
                  group={group}
                  displayedTracks={displayedCurationResult}
                  spaceApartModes={spaceApartModes}
                  spaceApartSettings={spaceApartSettings}
                  setSpaceApartModes={setSpaceApartModes}
                  setSpaceApartSettings={setSpaceApartSettings}
                  deleteTrackFromResult={deleteTrackFromResult}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="mb-4 text-lg font-semibold text-white">Curate & Send</h3>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_260px_140px_170px]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
                Leads
              </label>
              <input
                type="number"
                min={0}
                value={leadsCount}
                onChange={(e) => setLeadsCount(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
                Master Playlists Saved
              </label>
              <select
                value={selectedMasterPlaylistId}
                onChange={(e) => setSelectedMasterPlaylistId(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-green-500"
              >
                <option value="">Select saved master playlist</option>
                {savedMasterPlaylists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setPreviewOpen((prev) => !prev)}
              className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
                previewOpen
                  ? "bg-green-600 text-white hover:bg-green-500"
                  : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Preview
            </button>

            <button
              type="button"
              onClick={sendToPlaylistManager}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Send {displayedCurationResult.length} tracks
            </button>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            {sendStatus ||
              "Leads sets how many tracks play first before ratio-based curation starts."}
          </div>
        </div>

        {previewOpen ? (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-5">
            <div className="mb-4 text-sm font-semibold text-white">Final Playlist Structure</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Leads</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {previewSummary?.leads ?? 0}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Source Ratio
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {previewSummary?.sourceRatio ?? 0}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  My Ratio
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {previewSummary?.myRatio ?? 0}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Total Tracks
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {previewSummary?.totalTracks ?? 0}
                </div>
              </div>

              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-green-400">
                  Duplicate Groups
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {previewSummary?.duplicatesCount ?? 0}
                </div>
              </div>
            </div>

            <div className="scrollbar-spotify mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {displayedCurationResult.map((track, index) => {
                const key = trackKey(track);
                const isSource = sourceTrackKeys.has(key);
                const isMine = myTrackKeys.has(key);
                const isDuplicate = duplicateTrackKeys.has(key);

                const dotClass = isDuplicate
                  ? "bg-green-400"
                  : isSource
                    ? "bg-red-400"
                    : isMine
                      ? "bg-yellow-300"
                      : "bg-zinc-400";

                const borderClass = isDuplicate
                  ? "border-green-500/40"
                  : "border-zinc-800";

                return (
                  <div
                    key={`preview-${trackIdentity(track)}-${index}`}
                    className={`flex items-center rounded-lg border bg-black px-3 py-3 text-sm text-zinc-300 ${borderClass}`}
                  >
                    <ResultDot colorClass={dotClass} />
                    <span>
                      {index + 1}. {formatTrackLine(track)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <SavedCurationsCard
        savedCurations={savedCurations}
        selectedCurationId={selectedCurationId}
        curationName={curationName}
        setCurationName={setCurationName}
        saveCuration={saveCuration}
        updateCuration={updateCuration}
        loadCuration={loadCuration}
        deleteCuration={deleteCuration}
        canSave={displayedCurationResult.length > 0}
      />
    </div>
  );
}