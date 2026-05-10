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
import { type CurationTrack } from "@/lib/api/curation";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

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
  mergedTracks?: CurationTrack[];
};

type ImportHistoryItem = {
  id: string;
  display_name: string;
  link: string;
  source_type: string;
  track_count: number;
  accountName?: string;
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
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

const SOURCE_LINK_COLORS = [
  "bg-red-500",
  "bg-yellow-400",
  "bg-cyan-400",
  "bg-purple-500",
  "bg-lime-400",
  "bg-pink-500",
  "bg-blue-500",
  "bg-orange-500",
];

const MY_LINK_COLORS = [
  "bg-emerald-400",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-violet-400",
  "bg-teal-300",
  "bg-indigo-500",
];

const LINK_COLORS = SOURCE_LINK_COLORS;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeImportedLinkId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function savedCurationsStorageKey(accountId: number | null) {
  return `nerd-engine-saved-curations-${accountId ?? "none"}`;
}

function normalizeSavedCuration(item: any): SavedCuration | null {
  if (!item) return null;

  const tracks = Array.isArray(item.tracks) ? item.tracks : [];
  const id = String(item.id ?? item.curation_id ?? `saved-${Date.now()}`);
  const name = String(item.name ?? item.title ?? "Untitled Curation");

  return {
    id,
    name,
    tracks,
    trackCount:
      Number(item.trackCount ?? item.track_count ?? tracks.length) || 0,
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
  };
}

async function fetchSavedCurationsFromDatabase(accountId: number | null) {
  const url = new URL(`${API_BASE_URL}/api/curations`);
  if (accountId) url.searchParams.set("account_id", String(accountId));

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Could not load saved curations.");

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : (payload.items ?? []);

  return items
    .map((item: any) => normalizeSavedCuration(item))
    .filter(Boolean) as SavedCuration[];
}

async function saveCurationToDatabase(payload: {
  id?: string;
  name: string;
  account_id: number | null;
  tracks: CurationTrack[];
}) {
  const response = await fetch(`${API_BASE_URL}/api/curations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not save curation.");
  }

  return response.json();
}

async function updateCurationInDatabase(
  id: string,
  payload: { name: string; account_id: number | null; tracks: CurationTrack[] },
) {
  const response = await fetch(`${API_BASE_URL}/api/curations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not update curation.");
  }

  return response.json();
}

async function deleteCurationFromDatabase(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/curations/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(text || "Could not delete curation.");
  }
}

function normalizeSavedMasterPlaylist(
  item: any,
  index: number,
): SavedMasterPlaylist | null {
  if (!item) return null;

  const id = String(
    item.id ?? item.playlist_id ?? item.spotify_id ?? `master-${index}`,
  );
  const name = String(
    item.name ??
      item.title ??
      item.playlist_name ??
      `Master Playlist ${index + 1}`,
  );

  return {
    id,
    name,
    tracks:
      Number(item.tracks ?? item.trackCount ?? item.tracks_count ?? 0) || 0,
    createdAt: item.createdAt ?? item.created_at ?? undefined,
  };
}

function extractArrayFromPossibleStorageValue(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.playlists)) return value.playlists;
  if (Array.isArray(value?.savedMasterPlaylists))
    return value.savedMasterPlaylists;
  if (Array.isArray(value?.masterPlaylists)) return value.masterPlaylists;
  if (Array.isArray(value?.saved)) return value.saved;
  return [];
}

function loadSavedMasterPlaylists(): SavedMasterPlaylist[] {
  if (typeof window === "undefined") return [];

  const preferredKeys = [
    "nerd-engine-master-playlists",
    "nerd-engine-saved-master-playlists",
    "nerd-engine-playlist-manager-master-playlists",
    "playlist-manager-master-playlists",
    "masterPlaylists",
    "savedMasterPlaylists",
  ];

  const allKeys = Array.from({ length: window.localStorage.length })
    .map((_, index) => window.localStorage.key(index))
    .filter(Boolean) as string[];

  const keys = Array.from(
    new Set([
      ...preferredKeys,
      ...allKeys.filter((key) =>
        /master|playlist-manager|saved.*playlist/i.test(key),
      ),
    ]),
  );

  const collected: SavedMasterPlaylist[] = [];
  const seen = new Set<string>();

  keys.forEach((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const array = extractArrayFromPossibleStorageValue(parsed);

      array.forEach((item: any, index: number) => {
        const normalized = normalizeSavedMasterPlaylist(item, index);
        if (!normalized || seen.has(normalized.id)) return;
        seen.add(normalized.id);
        collected.push(normalized);
      });
    } catch {
      // Ignore malformed saved data and try the next key.
    }
  });

  return collected;
}

const HISTORY_DB_NAME = "nerd-engine-curation-history-db";
const HISTORY_STORE_NAME = "history";

function openHistoryDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(HISTORY_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        db.createObjectStore(HISTORY_STORE_NAME, { keyPath: "side" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function loadImportHistoryFromIndexedDb(
  side: "source" | "my",
): Promise<ImportHistoryItem[]> {
  const db = await openHistoryDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    const transaction = db.transaction(HISTORY_STORE_NAME, "readonly");
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.get(side);

    request.onsuccess = () => {
      const items = request.result?.items;
      resolve(Array.isArray(items) ? items : []);
      db.close();
    };

    request.onerror = () => {
      resolve([]);
      db.close();
    };
  });
}

async function saveImportHistoryToIndexedDb(
  side: "source" | "my",
  items: ImportHistoryItem[],
) {
  const db = await openHistoryDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(HISTORY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.put({ side, items, updatedAt: new Date().toISOString() });

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

function importHistoryStorageKey(side: "source" | "my") {
  return `nerd-engine-curation-import-history-${side}`;
}

function loadImportHistory(side: "source" | "my"): ImportHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(importHistoryStorageKey(side));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveImportHistory(side: "source" | "my", items: ImportHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    importHistoryStorageKey(side),
    JSON.stringify(items),
  );
  void saveImportHistoryToIndexedDb(side, items);
}

function addToImportHistory(
  side: "source" | "my",
  payload: ImportedLinkWithId,
) {
  if (typeof window === "undefined") return;
  if (payload.source_type === "track") return;

  const nextItem: ImportHistoryItem = {
    id: payload.id || makeImportedLinkId(),
    display_name: payload.display_name || "Imported Playlist",
    link: payload.link,
    source_type: payload.source_type,
    track_count: payload.track_count,
    accountName: payload.accountName,
  };

  const current = loadImportHistory(side);
  const next = [
    nextItem,
    ...current.filter((item) => item.link !== nextItem.link),
  ].slice(0, 80);
  saveImportHistory(side, next);
}

function addRawPlaylistLinkToImportHistory(
  side: "source" | "my",
  link: string,
) {
  if (typeof window === "undefined") return;
  if (!extractSpotifyPlaylistId(link)) return;

  const current = loadImportHistory(side);
  const existing = current.find((item) => item.link === link);
  if (existing) return;

  const nextItem: ImportHistoryItem = {
    id: makeImportedLinkId(),
    display_name: "Spotify Playlist",
    link,
    source_type: "playlist",
    track_count: 0,
    accountName: "Spotify",
  };

  saveImportHistory(side, [nextItem, ...current].slice(0, 80));
}

function extractSpotifyTrackId(input: string) {
  const clean = input.trim();
  const urlMatch = clean.match(/track\/([A-Za-z0-9]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  const uriMatch = clean.match(/^spotify:track:([A-Za-z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  if (/^[A-Za-z0-9]{16,}$/.test(clean)) return clean;
  return null;
}

function extractSpotifyPlaylistId(input: string) {
  const clean = input.trim();
  const urlMatch = clean.match(/playlist\/([A-Za-z0-9]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  const uriMatch = clean.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  return null;
}

function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const output = [...items];
  const [moved] = output.splice(fromIndex, 1);
  output.splice(toIndex, 0, moved);
  return output;
}

function weightedShuffle<T>(items: T[]): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[randomIndex]] = [output[randomIndex], output[index]];
  }
  return output;
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
    const candidate =
      "id" in item && typeof item.id === "string" ? item.id : "";
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
  const source = row?.track && typeof row.track === "object" ? row.track : row;
  const artists = Array.isArray(source?.artists)
    ? source.artists
        .map((artist: any) => artist?.name)
        .filter(Boolean)
        .join(", ")
    : "";

  const spotifyId =
    typeof source?.spotify_id === "string"
      ? source.spotify_id
      : typeof source?.track_id === "string"
        ? source.track_id
        : typeof source?.id === "string"
          ? source.id
          : null;

  const title =
    typeof source?.title === "string"
      ? source.title
      : typeof source?.name === "string"
        ? source.name
        : "Untitled Track";

  const artist =
    typeof source?.artist === "string" && source.artist.trim()
      ? source.artist
      : typeof source?.artist_name === "string" && source.artist_name.trim()
        ? source.artist_name
        : artists || "Unknown Artist";

  return {
    id: spotifyId || `imported-track-${index}-${Date.now()}`,
    spotify_id: spotifyId,
    title,
    artist,
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

async function fetchPublicSpotifyTrack(
  spotifyTrackId: string,
): Promise<CurationTrack | null> {
  const endpointCandidates = [
    `${API_BASE_URL}/api/spotify/public-track/${spotifyTrackId}`,
    `${API_BASE_URL}/api/spotify/tracks/${spotifyTrackId}`,
    `${API_BASE_URL}/api/spotify/track?spotify_track_id=${encodeURIComponent(spotifyTrackId)}`,
    `${API_BASE_URL}/api/tracks/${spotifyTrackId}`,
  ];

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const payload = await response.json();
      const trackPayload = payload?.track ?? payload;
      const normalized = normalizeImportedTrack(trackPayload, 0);
      if (
        normalized.title &&
        normalized.artist &&
        normalized.artist !== "Unknown Artist"
      ) {
        return normalized;
      }
    } catch {
      // Try next backend shape.
    }
  }

  return null;
}

async function fetchExternalSpotifyPlaylist(
  spotifyPlaylistId: string,
  url: string,
): Promise<ImportedLinkWithId | null> {
  const endpointCandidates = [
    `${API_BASE_URL}/api/spotify/public-playlist/${spotifyPlaylistId}/tracks`,
    `${API_BASE_URL}/api/spotify/public-playlists/${spotifyPlaylistId}/tracks`,
    `${API_BASE_URL}/api/spotify/public-playlist/${spotifyPlaylistId}`,
    `${API_BASE_URL}/api/spotify/playlists/${spotifyPlaylistId}/tracks`,
    `${API_BASE_URL}/api/spotify/playlist-tracks?spotify_playlist_id=${encodeURIComponent(spotifyPlaylistId)}`,
    `${API_BASE_URL}/api/playlists/external/${spotifyPlaylistId}/tracks`,
  ];

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const payload = await response.json();
      const tracksPayload = payload?.tracks ?? payload?.items ?? payload;
      const playlist = payload?.playlist ?? {
        name:
          payload?.name ||
          payload?.playlist_name ||
          "Imported Spotify Playlist",
      };
      const normalized = normalizeImportedLinkPayload({
        playlist,
        tracksPayload,
        url,
        accountName:
          playlist?.owner_display_name || playlist?.owner_name || "Spotify",
      });
      if (normalized.tracks.length > 0) return normalized;
    } catch {
      // Try next backend shape.
    }
  }

  return null;
}

async function importSpotifyTrackLink(
  url: string,
): Promise<ImportedLinkWithId> {
  const spotifyTrackId = extractSpotifyTrackId(url);
  if (!spotifyTrackId)
    throw new Error("Paste a valid Spotify playlist or track link.");

  const publicTrack = await fetchPublicSpotifyTrack(spotifyTrackId);
  if (publicTrack) {
    return {
      id: makeImportedLinkId(),
      link: url,
      display_name: formatTrackLine(publicTrack),
      accountName: "Spotify Track",
      source_type: "track",
      track_count: 1,
      tracks: [publicTrack],
    };
  }

  let title = "Spotify Track";
  let artist = "Unknown Artist";

  try {
    const response = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(
        `https://open.spotify.com/track/${spotifyTrackId}`,
      )}`,
    );

    if (response.ok) {
      const payload = await response.json();
      const rawTitle = String(payload?.title || "").trim();
      const authorName = String(
        payload?.author_name || payload?.provider_name || "",
      ).trim();
      if (rawTitle) {
        const separators = [" - ", " – ", " — "];
        const separator = separators.find((item) => rawTitle.includes(item));
        if (separator) {
          const parts = rawTitle.split(separator);
          title = parts[0]?.trim() || rawTitle;
          artist =
            parts.slice(1).join(separator).trim() || authorName || artist;
        } else {
          title = rawTitle;
          artist = authorName || artist;
        }
      } else if (authorName) {
        artist = authorName;
      }
    }
  } catch {
    // Keep fallback title and artist when oEmbed is not available.
  }

  return {
    id: makeImportedLinkId(),
    link: url,
    display_name: `${title} - ${artist}`,
    accountName: "Spotify Track",
    source_type: "track",
    track_count: 1,
    tracks: [
      {
        id: spotifyTrackId,
        spotify_id: spotifyTrackId,
        title,
        artist,
      } as CurationTrack,
    ],
  };
}

async function importExternalSpotifyPlaylistFromAccount(
  accountId: number,
  accountName: string,
  spotifyPlaylistId: string,
  url: string,
): Promise<ImportedLinkWithId | null> {
  const endpointCandidates = [
    `${API_BASE_URL}/api/accounts/${accountId}/spotify-playlists/${spotifyPlaylistId}/tracks`,
    `${API_BASE_URL}/api/accounts/${accountId}/playlists/by-spotify-id/${spotifyPlaylistId}/tracks`,
    `${API_BASE_URL}/api/accounts/${accountId}/playlist-tracks?spotify_playlist_id=${encodeURIComponent(spotifyPlaylistId)}`,
  ];

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const payload = await response.json();
      const tracksPayload = payload?.tracks ?? payload?.items ?? payload;
      const playlist = payload?.playlist ?? {
        name:
          payload?.name ||
          payload?.playlist_name ||
          "Imported Spotify Playlist",
      };
      const normalized = normalizeImportedLinkPayload({
        playlist,
        tracksPayload,
        url,
        accountName,
      });
      if (normalized.tracks.length > 0) return normalized;
    } catch {
      // Try the next supported backend endpoint.
    }
  }

  return null;
}

async function importSpotifyLinkFromAccount(
  accountId: number,
  accountName: string,
  url: string,
): Promise<ImportedLinkWithId> {
  if (!accountId || accountId <= 0) {
    throw new Error("Invalid account ID.");
  }

  const spotifyTrackId = extractSpotifyTrackId(url);
  if (spotifyTrackId && !url.includes("playlist/")) {
    return importSpotifyTrackLink(url);
  }

  const spotifyPlaylistId = extractSpotifyPlaylistId(url);

  if (!spotifyPlaylistId) {
    throw new Error("Paste a valid Spotify playlist or track link.");
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
      item.spotify_url?.includes(spotifyPlaylistId) ||
      item.external_url?.includes(spotifyPlaylistId)
    );
  });

  if (!playlist?.id) {
    const externalImport = await importExternalSpotifyPlaylistFromAccount(
      accountId,
      accountName,
      spotifyPlaylistId,
      url,
    );

    if (externalImport) return externalImport;

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
  if (extractSpotifyTrackId(url) && !url.includes("playlist/")) {
    return importSpotifyTrackLink(url);
  }

  const spotifyPlaylistId = extractSpotifyPlaylistId(url);
  if (spotifyPlaylistId) {
    const publicPlaylist = await fetchExternalSpotifyPlaylist(
      spotifyPlaylistId,
      url,
    );
    if (publicPlaylist) return publicPlaylist;
  }

  const realAccounts = accounts.filter((account) => account.id > 0);

  if (realAccounts.length === 0) {
    throw new Error("No Spotify accounts found.");
  }

  const errors: string[] = [];

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

      errors.push(
        `No tracks found in ${account.display_name || `Account ${account.id}`}.`,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Import failed.");
    }
  }

  throw new Error(
    "Playlist tracks could not be imported. Public playlist import needs the backend external Spotify playlist route. Synced playlists and Spotify track links still work.",
  );
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
  return [
    ...typedTracks,
    ...importedLinks.flatMap((item) => item.mergedTracks ?? item.tracks),
  ];
}

function shuffleTracksList<T>(items: T[]): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[randomIndex]] = [output[randomIndex], output[index]];
  }
  return output;
}

function interleaveByRatio(
  first: CurationTrack[],
  second: CurationTrack[],
  firstRatio: number,
  secondRatio: number,
): CurationTrack[] {
  const firstQueue = [...first];
  const secondQueue = [...second];
  const output: CurationTrack[] = [];
  const safeFirstRatio = Math.max(1, firstRatio || 1);
  const safeSecondRatio = Math.max(1, secondRatio || 1);

  while (firstQueue.length > 0 || secondQueue.length > 0) {
    for (
      let index = 0;
      index < safeFirstRatio && firstQueue.length > 0;
      index += 1
    ) {
      output.push(firstQueue.shift() as CurationTrack);
    }

    for (
      let index = 0;
      index < safeSecondRatio && secondQueue.length > 0;
      index += 1
    ) {
      output.push(secondQueue.shift() as CurationTrack);
    }
  }

  return output;
}

function ResultDot({ colorClass }: { colorClass: string }) {
  return (
    <span className={`mr-3 h-2.5 w-2.5 shrink-0 rounded-full ${colorClass}`} />
  );
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
      const nextTracks = item.tracks.filter(
        (entry) => trackKey(entry) !== target,
      );

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

    const current = map.get(normalizedTitle) ?? {
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
          group.exactTitles.size === 1 && group.artists.size > 1
            ? "exact"
            : "similar",
      } satisfies DuplicateGroup;
    })
    .filter((group) => group.tracks.length > 1);
}

function findTrackIndexByIdentity(
  tracks: CurationTrack[],
  target: CurationTrack,
) {
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

function TrackDots({
  colorIndexes,
  colorPalette = LINK_COLORS,
}: {
  colorIndexes: number[];
  colorPalette?: string[];
}) {
  if (colorIndexes.length === 0) return null;

  return (
    <div className="mr-3 flex shrink-0 items-center gap-1.5">
      {colorIndexes.map((index, dotIndex) => (
        <span
          key={`${index}-${dotIndex}`}
          className={`h-2.5 w-2.5 rounded-full ${colorPalette[index % colorPalette.length]}`}
        />
      ))}
    </div>
  );
}

type HistorySection = {
  side: "source" | "my";
  title: string;
  items: ImportHistoryItem[];
  setItems: Dispatch<SetStateAction<ImportHistoryItem[]>>;
  onImportItems: (items: ImportHistoryItem[]) => Promise<void>;
};

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
  colorPalette,
  historySections,
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
  colorPalette: string[];
  historySections: HistorySection[];
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

  const [ratioOne, setRatioOne] = useState("3");
  const [ratioTwo, setRatioTwo] = useState("1");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyImporting, setHistoryImporting] = useState(false);
  const [historyStatus, setHistoryStatus] = useState("");
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<string[]>([]);
  const [draggedImportedIndex, setDraggedImportedIndex] = useState<
    number | null
  >(null);
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(
    null,
  );

  const randomShuffleTracks = () => {
    setImportedLinks((prev) => {
      if (prev.length <= 1) {
        return prev.map((item) => ({
          ...item,
          tracks: shuffleTracksList(item.tracks),
          mergedTracks: undefined,
        }));
      }

      const mixed = weightedShuffle(prev.flatMap((item) => item.tracks));
      return prev.map((item, index) =>
        index === 0
          ? { ...item, mergedTracks: mixed }
          : { ...item, mergedTracks: [] },
      );
    });
  };

  const ratioShuffleTracks = () => {
    setImportedLinks((prev) => {
      if (prev.length < 2) return prev;

      const queues = prev.map((item) => [...item.tracks]);
      const firstWeight = Math.max(1, Number(ratioOne) || 1);
      const otherWeight = Math.max(1, Number(ratioTwo) || 1);
      const mixed: CurationTrack[] = [];

      while (queues.some((queue) => queue.length > 0)) {
        queues.forEach((queue, index) => {
          const weight = index === 0 ? firstWeight : otherWeight;
          for (let step = 0; step < weight && queue.length > 0; step += 1) {
            mixed.push(queue.shift() as CurationTrack);
          }
        });
      }

      return prev.map((item, index) =>
        index === 0
          ? { ...item, mergedTracks: mixed }
          : { ...item, mergedTracks: [] },
      );
    });
  };

  const visibleHistorySections = historySections.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.source_type !== "track"),
  }));

  const selectedHistoryCount = selectedHistoryKeys.length;

  useEffect(() => {
    if (!historyOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyOpen]);

  const removeHistoryItem = (section: HistorySection, id: string) => {
    const next = section.items.filter((item) => item.id !== id);
    section.setItems(next);
    saveImportHistory(section.side, next);
    setSelectedHistoryKeys((current) =>
      current.filter((itemKey) => itemKey !== `${section.side}:${id}`),
    );
  };

  const toggleHistoryItem = (
    side: "source" | "my",
    id: string,
    checked: boolean,
  ) => {
    const key = `${side}:${id}`;
    setSelectedHistoryKeys((current) =>
      checked
        ? Array.from(new Set([...current, key]))
        : current.filter((item) => item !== key),
    );
  };

  const importSelectedHistory = async () => {
    const sectionsToImport = visibleHistorySections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        selectedHistoryKeys.includes(`${section.side}:${item.id}`),
      ),
    }));

    const total = sectionsToImport.reduce(
      (sum, section) => sum + section.items.length,
      0,
    );
    if (total === 0) return;

    setHistoryImporting(true);
    setHistoryStatus(`0/${total} imported`);

    let completed = 0;
    try {
      for (const section of sectionsToImport) {
        for (const item of section.items) {
          completed += 1;
          const nextStatus = `${completed}/${total} imported · ${item.display_name}`;
          setHistoryStatus(nextStatus);
          await section.onImportItems([item]);
        }
      }
      setSelectedHistoryKeys([]);
      setHistoryStatus(`Imported ${completed}/${total} playlist${total === 1 ? "" : "s"} from history.`);
      setHistoryOpen(false);
    } finally {
      setHistoryImporting(false);
      setHistoryStatus("");
    }
  };

  const reorderImportedLinks = (targetIndex: number) => {
    if (draggedImportedIndex === null || draggedImportedIndex === targetIndex) {
      setDraggedImportedIndex(null);
      return;
    }

    setImportedLinks((prev) =>
      reorderItems(prev, draggedImportedIndex, targetIndex),
    );
    setDraggedImportedIndex(null);
  };

  const reorderVisibleTrack = (targetIndex: number) => {
    if (draggedTrackIndex === null || draggedTrackIndex === targetIndex) {
      setDraggedTrackIndex(null);
      return;
    }

    setImportedLinks((prev) => {
      if (prev.length === 0) return prev;
      const reordered = reorderItems(tracks, draggedTrackIndex, targetIndex);
      return prev.map((item, index) =>
        index === 0
          ? { ...item, mergedTracks: reordered }
          : { ...item, mergedTracks: [] },
      );
    });

    setDraggedTrackIndex(null);
  };

  return (
    <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(39,39,42,0.35),rgba(9,9,11,0.9))] p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <div className="mt-2 text-[20px] font-semibold text-white">
            {tracks.length} tracks
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900"
            title="Import history"
          >
            ♥
          </button>

          <button
            onClick={clearSide}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            Clear
          </button>
        </div>
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
        <div className="mb-3 text-sm font-semibold text-white">
          Imported Links
        </div>

        {importedLinks.length === 0 ? (
          <div className="text-sm text-zinc-500">No imported links yet.</div>
        ) : (
          <div className="space-y-3">
            {importedLinks.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                draggable
                onDragStart={() => setDraggedImportedIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderImportedLinks(index)}
                className="cursor-move rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${colorPalette[index % colorPalette.length]}`}
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
        <div className="mb-3 text-sm font-semibold text-white">
          Tracks In List
        </div>

        {tracks.length === 0 ? (
          <div className="text-sm text-zinc-500">
            No tracks in this list yet.
          </div>
        ) : (
          <div className="scrollbar-spotify max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {tracks.map((track, index) => {
              const colorIndexes = trackColorMap.get(trackKey(track)) ?? [];

              return (
                <div
                  key={`${track.id}-${trackKey(track)}-${index}`}
                  draggable
                  onDragStart={() => setDraggedTrackIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderVisibleTrack(index)}
                  className="flex cursor-move items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center">
                    <TrackDots
                      colorIndexes={colorIndexes}
                      colorPalette={colorPalette}
                    />
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-3">
          <button
            type="button"
            onClick={randomShuffleTracks}
            disabled={tracks.length === 0}
            className="text-sm font-semibold text-green-400 transition hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Random Shuffle
          </button>

          <div className="flex items-center gap-2">
            <input
              value={ratioOne}
              onChange={(event) => setRatioOne(event.target.value)}
              className="h-8 w-12 rounded-lg border border-zinc-800 bg-black px-2 text-center text-xs font-semibold text-white outline-none focus:border-green-500"
            />
            <input
              value={ratioTwo}
              onChange={(event) => setRatioTwo(event.target.value)}
              className="h-8 w-12 rounded-lg border border-zinc-800 bg-black px-2 text-center text-xs font-semibold text-white outline-none focus:border-green-500"
            />
            <button
              type="button"
              onClick={ratioShuffleTracks}
              disabled={importedLinks.length < 2}
              className="text-sm font-semibold text-green-400 transition hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Shuffle
            </button>
          </div>
        </div>
      </div>

      {historyOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">History</div>
                <div className="mt-1 text-xs text-zinc-500">{title}</div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-900"
              >
                X
              </button>
            </div>

            <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {visibleHistorySections.map((section) => (
                <div
                  key={section.side}
                  className="rounded-2xl border border-zinc-800 bg-black p-3"
                >
                  <div className="mb-3 text-sm font-semibold text-white">
                    {section.title}
                  </div>
                  {section.items.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-500">
                      No playlists saved.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {section.items.map((item) => {
                        const key = `${section.side}:${item.id}`;
                        const checked = selectedHistoryKeys.includes(key);

                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3"
                          >
                            <label className="flex min-w-0 flex-1 items-center gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  toggleHistoryItem(
                                    section.side,
                                    item.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">
                                  {item.display_name}
                                </div>
                                <div className="mt-1 truncate text-xs text-zinc-500">
                                  {item.track_count} tracks ·{" "}
                                  {item.accountName || "Spotify"}
                                </div>
                              </div>
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                removeHistoryItem(section, item.id)
                              }
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                            >
                              X
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              {historyStatus ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-green-300">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
                  {historyStatus}
                </div>
              ) : null}
              <button
                type="button"
                disabled={selectedHistoryCount === 0 || historyImporting}
                onClick={importSelectedHistory}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {historyImporting ? "Importing..." : "Import Selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
          const calculatedIndex = findTrackIndexByIdentity(
            displayedTracks,
            track,
          );
          const displayNumber =
            calculatedIndex >= 0 ? calculatedIndex + 1 : "?";

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
  loadCuration,
  deleteCuration,
}: {
  savedCurations: SavedCuration[];
  selectedCurationId: string;
  loadCuration: (id: string) => void;
  deleteCuration: (id: string) => void;
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

        <span className="text-sm font-semibold text-zinc-400">
          {open ? "-" : "+"}
        </span>
      </button>

      {open ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {savedCurations.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-500">
              No saved curations yet.
            </div>
          ) : (
            savedCurations.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border bg-black px-4 py-4 ${
                  selectedCurationId === item.id
                    ? "border-green-500/50"
                    : "border-zinc-800"
                }`}
              >
                <div className="text-sm font-semibold text-white">
                  {item.name}
                </div>
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
      ) : null}
    </div>
  );
}

export default function CurationPage() {
  const router = useRouter();
  const activeAccountId = useActiveAccountStore(
    (state) => state.activeAccountId,
  );

  const [sourceText, setSourceText] = useState("");
  const [myTracksText, setMyTracksText] = useState("");
  const [sourceLinkInput, setSourceLinkInput] = useState("");
  const [myTracksLinkInput, setMyTracksLinkInput] = useState("");
  const [sourceImportedLinks, setSourceImportedLinks] = useState<
    ImportedLinkWithId[]
  >([]);
  const [myImportedLinks, setMyImportedLinks] = useState<ImportedLinkWithId[]>(
    [],
  );

  const [sourceRatio, setSourceRatio] = useState("3");
  const [myRatio, setMyRatio] = useState("1");
  const [leadsCount, setLeadsCount] = useState("15");

  const [curationName, setCurationName] = useState("");
  const [savedCurations, setSavedCurations] = useState<SavedCuration[]>([]);
  const [selectedCurationId, setSelectedCurationId] = useState("");
  const [curationBaseResult, setCurationBaseResult] = useState<CurationTrack[]>(
    [],
  );
  const [spaceApartSettings, setSpaceApartSettings] =
    useState<SpaceApartSettings>({});
  const [spaceApartModes, setSpaceApartModes] = useState<SpaceApartModes>({});
  const [selectedMasterPlaylistId, setSelectedMasterPlaylistId] = useState("");
  const [savedMasterPlaylists, setSavedMasterPlaylists] = useState<
    SavedMasterPlaylist[]
  >([]);
  const [sendStatus, setSendStatus] = useState("");
  const [undoStack, setUndoStack] = useState<CurationTrack[][]>([]);
  const [resultDragIndex, setResultDragIndex] = useState<number | null>(null);
  const [sourceImportHistory, setSourceImportHistory] = useState<
    ImportHistoryItem[]
  >([]);
  const [myImportHistory, setMyImportHistory] = useState<ImportHistoryItem[]>(
    [],
  );

  const accountsQuery = useQuery<AccountItem[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    retry: false,
  });

  const accounts = useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setSelectedCurationId("");

      try {
        const items = await fetchSavedCurationsFromDatabase(activeAccountId);
        if (!cancelled) {
          setSavedCurations(items);
          if (activeAccountId) {
            window.localStorage.setItem(
              savedCurationsStorageKey(activeAccountId),
              JSON.stringify(items),
            );
          }
        }
        return;
      } catch {
        // Fall back to localStorage when backend is not available locally.
      }

      try {
        const raw = window.localStorage.getItem(
          savedCurationsStorageKey(activeAccountId),
        );
        if (!cancelled) setSavedCurations(raw ? JSON.parse(raw) : []);
      } catch {
        if (!cancelled) setSavedCurations([]);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [activeAccountId]);

  useEffect(() => {
    let cancelled = false;

    const sourceLocal = loadImportHistory("source");
    const myLocal = loadImportHistory("my");
    setSourceImportHistory(sourceLocal);
    setMyImportHistory(myLocal);

    const restorePersistentHistory = async () => {
      const [sourceIndexed, myIndexed] = await Promise.all([
        loadImportHistoryFromIndexedDb("source"),
        loadImportHistoryFromIndexedDb("my"),
      ]);

      if (cancelled) return;

      if (sourceIndexed.length > sourceLocal.length) {
        setSourceImportHistory(sourceIndexed);
        window.localStorage.setItem(
          importHistoryStorageKey("source"),
          JSON.stringify(sourceIndexed),
        );
      }

      if (myIndexed.length > myLocal.length) {
        setMyImportHistory(myIndexed);
        window.localStorage.setItem(
          importHistoryStorageKey("my"),
          JSON.stringify(myIndexed),
        );
      }
    };

    void restorePersistentHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshSavedMasters = () => {
      const items = loadSavedMasterPlaylists();
      setSavedMasterPlaylists(items);
      setSelectedMasterPlaylistId((current) => current || items[0]?.id || "");
    };

    refreshSavedMasters();
    window.addEventListener("storage", refreshSavedMasters);

    return () => {
      window.removeEventListener("storage", refreshSavedMasters);
    };
  }, []);

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
    () =>
      enforceGroupSpacing(
        curationBaseResult,
        duplicateGroups,
        spaceApartSettings,
      ),
    [curationBaseResult, duplicateGroups, spaceApartSettings],
  );

  const duplicateTrackKeys = useMemo(() => {
    const keys = new Set<string>();

    duplicateGroups.forEach((group) => {
      group.tracks.forEach((track) => keys.add(trackKey(track)));
    });

    return keys;
  }, [duplicateGroups]);

  const sourcePlaylistColorMap = useMemo(() => {
    const map = new Map<string, number>();
    sourceImportedLinks.forEach((item, itemIndex) => {
      item.tracks.forEach((track) => map.set(trackKey(track), itemIndex));
    });
    return map;
  }, [sourceImportedLinks]);

  const myPlaylistColorMap = useMemo(() => {
    const map = new Map<string, number>();
    myImportedLinks.forEach((item, itemIndex) => {
      item.tracks.forEach((track) => map.set(trackKey(track), itemIndex));
    });
    return map;
  }, [myImportedLinks]);

  const pushUndo = () => {
    setUndoStack((current) => [curationBaseResult, ...current].slice(0, 30));
  };

  const undoLastChange = () => {
    setUndoStack((current) => {
      const [previous, ...rest] = current;
      if (!previous) return current;
      setCurationBaseResult(previous);
      return rest;
    });
  };

  const sourceImportMutation = useMutation({
    mutationFn: (link: string) => importSpotifyLinkAllAccounts(accounts, link),
    onMutate: (link: string) => {
      addRawPlaylistLinkToImportHistory("source", link);
      setSourceImportHistory(loadImportHistory("source"));
    },
    onSuccess: (payload) => {
      setSourceImportedLinks((prev) =>
        ensureImportedLinkIds([...prev, payload]),
      );
      addToImportHistory("source", payload);
      setSourceImportHistory(loadImportHistory("source"));
      setSourceLinkInput("");
    },
  });

  const myTracksImportMutation = useMutation({
    mutationFn: (link: string) => importSpotifyLinkAllAccounts(accounts, link),
    onMutate: (link: string) => {
      addRawPlaylistLinkToImportHistory("my", link);
      setMyImportHistory(loadImportHistory("my"));
    },
    onSuccess: (payload) => {
      setMyImportedLinks((prev) => ensureImportedLinkIds([...prev, payload]));
      addToImportHistory("my", payload);
      setMyImportHistory(loadImportHistory("my"));
      setMyTracksLinkInput("");
    },
  });

  const importHistoryItems = async (
    side: "source" | "my",
    items: ImportHistoryItem[],
  ) => {
    setSendStatus(
      `Importing ${items.length} playlist${items.length === 1 ? "" : "s"} from history...`,
    );
    for (const item of items) {
      try {
        const payload = await importSpotifyLinkAllAccounts(accounts, item.link);
        if (side === "source") {
          setSourceImportedLinks((prev) =>
            ensureImportedLinkIds([...prev, payload]),
          );
        } else {
          setMyImportedLinks((prev) =>
            ensureImportedLinkIds([...prev, payload]),
          );
        }
      } catch (error) {
        setSendStatus(
          error instanceof Error
            ? error.message
            : "Import from history failed.",
        );
      }
    }
  };

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
    pushUndo();

    setCurationBaseResult((prev) =>
      prev.filter((track) => trackIdentity(track) !== targetIdentity),
    );
  };

  const removeDuplicateTracks = (tracksToDelete: CurationTrack[]) => {
    const identities = new Set(tracksToDelete.map(trackIdentity));
    pushUndo();
    setCurationBaseResult((prev) =>
      prev.filter((track) => !identities.has(trackIdentity(track))),
    );
  };

  const reorderResultTrack = (targetIndex: number) => {
    if (resultDragIndex === null || resultDragIndex === targetIndex) {
      setResultDragIndex(null);
      return;
    }

    pushUndo();
    setCurationBaseResult((prev) =>
      reorderItems(prev, resultDragIndex, targetIndex),
    );
    setResultDragIndex(null);
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

    pushUndo();
    setSpaceApartModes(nextModes);
    setSpaceApartSettings(nextSettings);
    setCurationBaseResult(output);
  };

  const saveCuration = async () => {
    if (displayedCurationResult.length === 0) {
      setSendStatus("Run curation first before saving.");
      return;
    }

    let name = curationName.trim();

    if (!name) {
      const requestedName = window.prompt("Enter curation name");
      name = requestedName?.trim() || "";
    }

    if (!name) return;

    const newSavedCuration: SavedCuration = {
      id: `saved-${Date.now()}`,
      name,
      tracks: displayedCurationResult,
      trackCount: displayedCurationResult.length,
      createdAt: new Date().toISOString(),
    };

    const updated = [newSavedCuration, ...savedCurations];
    persistSavedCurations(updated);
    setSelectedCurationId(newSavedCuration.id);
    setCurationName(name);
    setSendStatus("Curation saved.");

    try {
      const saved = await saveCurationToDatabase({
        id: newSavedCuration.id,
        name,
        account_id: activeAccountId,
        tracks: displayedCurationResult,
      });
      const normalized = normalizeSavedCuration(saved.item ?? saved);
      if (normalized) {
        const synced = [
          normalized,
          ...savedCurations.filter((item) => item.id !== normalized.id),
        ];
        persistSavedCurations(synced);
        setSelectedCurationId(normalized.id);
      }
    } catch (error) {
      setSendStatus("Saved locally. Database save failed.");
    }
  };

  const updateCuration = async () => {
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

    try {
      await updateCurationInDatabase(selectedCurationId, {
        name,
        account_id: activeAccountId,
        tracks: displayedCurationResult,
      });
    } catch {
      setSendStatus("Updated locally. Database update failed.");
    }
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

  const deleteCuration = async (id: string) => {
    const next = savedCurations.filter((item) => item.id !== id);
    persistSavedCurations(next);

    if (selectedCurationId === id) {
      setSelectedCurationId("");
      setCurationName("");
    }

    try {
      await deleteCurationFromDatabase(id);
    } catch {
      setSendStatus("Deleted locally. Database delete failed.");
    }
  };

  const sendToPlaylistManager = () => {
    if (displayedCurationResult.length === 0) {
      setSendStatus("Run curation first.");
      return;
    }

    const selectedMasterPlaylist =
      savedMasterPlaylists.find(
        (item) => item.id === selectedMasterPlaylistId,
      ) ?? null;

    window.localStorage.setItem(
      "nerd-engine-playlist-manager-curation-draft",
      JSON.stringify({
        created_at: new Date().toISOString(),
        account_id: activeAccountId,
        active_account_name: null,
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

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Curation Engine
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Build your final sequence by mixing source playlist tracks with your
            own track pool.
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Active Account: All Accounts
          </p>
        </div>

        <div className="w-full max-w-[320px]">
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
            colorPalette={SOURCE_LINK_COLORS}
            historySections={[
              {
                side: "source",
                title: "Source Playlist Tracks",
                items: sourceImportHistory,
                setItems: setSourceImportHistory,
                onImportItems: (items) => importHistoryItems("source", items),
              },
              {
                side: "my",
                title: "My Tracks",
                items: myImportHistory,
                setItems: setMyImportHistory,
                onImportItems: (items) => importHistoryItems("my", items),
              },
            ]}
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
            colorPalette={MY_LINK_COLORS}
            historySections={[
              {
                side: "source",
                title: "Source Playlist Tracks",
                items: sourceImportHistory,
                setItems: setSourceImportHistory,
                onImportItems: (items) => importHistoryItems("source", items),
              },
              {
                side: "my",
                title: "My Tracks",
                items: myImportHistory,
                setItems: setMyImportHistory,
                onImportItems: (items) => importHistoryItems("my", items),
              },
            ]}
          />
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-end">
          <div className="flex gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Leads
              </label>
              <input
                inputMode="numeric"
                value={leadsCount}
                onChange={(e) => setLeadsCount(e.target.value)}
                className="h-11 w-[110px] rounded-xl border border-zinc-800 bg-black px-4 text-sm font-medium text-white outline-none transition focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Source Ratio
              </label>
              <input
                value={sourceRatio}
                onChange={(e) => setSourceRatio(e.target.value)}
                className="h-11 w-[90px] rounded-xl border border-zinc-800 bg-black px-4 text-sm font-medium text-white outline-none transition focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                My Ratio
              </label>
              <input
                value={myRatio}
                onChange={(e) => setMyRatio(e.target.value)}
                className="h-11 w-[90px] rounded-xl border border-zinc-800 bg-black px-4 text-sm font-medium text-white outline-none transition focus:border-green-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={undoLastChange}
              disabled={undoStack.length === 0}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>

            <button
              onClick={runCuration}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-8 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Run Curation
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-4">
          <div className="mb-3 text-sm font-semibold text-white">
            Curation Result
          </div>

          {displayedCurationResult.length === 0 ? (
            <div className="text-sm text-zinc-500">
              Run curation to generate a result.
            </div>
          ) : (
            <div className="scrollbar-spotify max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {displayedCurationResult.map((track, index) => {
                const key = trackKey(track);
                const isSource = sourceTrackKeys.has(key);
                const isMine = myTrackKeys.has(key);
                const isDuplicate = duplicateTrackKeys.has(key);

                const sourceColorIndex = sourcePlaylistColorMap.get(key);
                const myColorIndex = myPlaylistColorMap.get(key);
                const sourceColorClass =
                  sourceColorIndex !== undefined
                    ? SOURCE_LINK_COLORS[
                        sourceColorIndex % SOURCE_LINK_COLORS.length
                      ]
                    : myColorIndex !== undefined
                      ? MY_LINK_COLORS[myColorIndex % MY_LINK_COLORS.length]
                      : "bg-zinc-500";

                const borderClass = isDuplicate
                  ? "border-green-500 border-2"
                  : isSource
                    ? "border-red-500/20"
                    : isMine
                      ? "border-yellow-500/20"
                      : "border-zinc-800";

                return (
                  <div
                    key={`${trackIdentity(track)}-${index}`}
                    draggable
                    onDragStart={() => setResultDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderResultTrack(index)}
                    className={`flex cursor-move items-center justify-between rounded-xl border bg-zinc-950 px-4 py-3 ${borderClass}`}
                  >
                    <div className="flex min-w-0 items-center">
                      <div className="mr-3 flex shrink-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full border border-white bg-white" />
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${sourceColorClass}`}
                        />
                      </div>
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-green-400">
                Duplicate Risk ({duplicateGroups.length})
              </div>
              <button
                type="button"
                onClick={() =>
                  removeDuplicateTracks(
                    duplicateGroups.flatMap((group) => group.tracks),
                  )
                }
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                Remove All
              </button>
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
          <h3 className="mb-5 text-lg font-semibold text-white">
            Save &amp; Send
          </h3>

          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full max-w-[320px]">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Curation Name
                </label>
                <input
                  value={curationName}
                  onChange={(e) => setCurationName(e.target.value)}
                  placeholder="Curation name..."
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-green-500"
                />
              </div>

              <button
                type="button"
                onClick={saveCuration}
                disabled={displayedCurationResult.length === 0}
                className="h-11 rounded-xl bg-green-600 px-6 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Curation
              </button>

              <button
                type="button"
                onClick={updateCuration}
                disabled={
                  !selectedCurationId || displayedCurationResult.length === 0
                }
                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <select
                value={selectedMasterPlaylistId}
                onChange={(e) => setSelectedMasterPlaylistId(e.target.value)}
                className="h-11 min-w-[260px] rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-green-500"
              >
                <option value="">Select saved master playlist</option>
                {savedMasterPlaylists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={sendToPlaylistManager}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-8 text-sm font-semibold text-white transition hover:bg-green-500"
              >
                Send {displayedCurationResult.length} tracks
              </button>
            </div>
          </div>

          {sendStatus ? (
            <div className="mt-4 text-xs text-zinc-500">{sendStatus}</div>
          ) : null}
        </div>
      </div>

      <SavedCurationsCard
        savedCurations={savedCurations}
        selectedCurationId={selectedCurationId}
        loadCuration={loadCuration}
        deleteCuration={deleteCuration}
      />
    </div>
  );
}
