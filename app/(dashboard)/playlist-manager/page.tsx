"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { getPlaylists, replacePlaylistTracks } from "@/lib/api/playlists";

type AccountItem = {
  id: number;
  display_name?: string;
};

type PlaylistItem = {
  id: number;
  name: string;
  followers?: number;
  tracks_count?: number;
  image_url?: string | null;
  spotify_url?: string | null;
  spotify_id?: string | null;
  spotify_playlist_id?: string | null;
  account_id?: number;
};

type FlatPlaylistItem = PlaylistItem & {
  playlistId?: number;
  accountId: number;
  accountName: string;
};

type AddedTrack = {
  id: string;
  spotify_id?: string | null;
  title: string;
  artist: string;
  createdAt?: string;
};

type SavedMasterPlaylistOption = {
  id: string;
  playlistId: number;
  accountId: number;
  name: string;
  imageUrl: string | null;
  tracks?: number;
  createdAt: string;
};

type MasterCurationBox = {
  id: string;
  masterPlaylistId: string;
  curationName: string;
  createdAt: string;
  tracks: AddedTrack[];
};

type SyncedPlaylistItem = {
  id: string;
  masterPlaylistId?: string | null;
  playlistId: number;
  accountId: number;
  name: string;
  imageUrl: string | null;
  spotifyUrl?: string | null;
  spotifyId?: string | null;
  checked: boolean;
  lastSyncedAt: string | null;
};

type PlaylistManagerState = {
  savedMasterPlaylists: SavedMasterPlaylistOption[];
  selectedSavedMasterPlaylistId: string | null;
  masterPlaylistId: number | null;
  masterPlaylistAccountId: number | null;
  masterPlaylistName: string;
  masterPlaylistImageUrl: string | null;
  masterPlaylistLastSyncedAt: string | null;
  masterPlaylistSyncHistory: string[];
  masterCurationBoxes: MasterCurationBox[];
  syncedPlaylists: SyncedPlaylistItem[];
};

type CurationDraft = {
  created_at?: string;
  curation_name?: string | null;
  target_master_playlist_id?: string | null;
  target_master_playlist_name?: string | null;
  tracks?: Array<{
    id?: string;
    spotify_id?: string | null;
    title?: string;
    name?: string;
    artist?: string;
    artist_name?: string | null;
  }>;
};

type ImportMode = "master" | "synced";
type AddTrackMode = "current" | "all";

const STORAGE_KEY = "nerd-engine-playlist-manager-global";
const CURATION_DRAFT_KEY = "nerd-engine-playlist-manager-curation-draft";
const PLAYLIST_MANAGER_USER_KEY = "global";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "https://spotify-growth-hub-backend.onrender.com";

const SAFE_SYNC_DELAY_MS = 5000;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const emptyState = (): PlaylistManagerState => ({
  savedMasterPlaylists: [],
  selectedSavedMasterPlaylistId: null,
  masterPlaylistId: null,
  masterPlaylistAccountId: null,
  masterPlaylistName: "",
  masterPlaylistImageUrl: null,
  masterPlaylistLastSyncedAt: null,
  masterPlaylistSyncHistory: [],
  masterCurationBoxes: [],
  syncedPlaylists: [],
});

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never synced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never synced";
  return date.toLocaleString();
}

function makeCurationTrackKey(track: AddedTrack, index: number) {
  return `${track.id || track.spotify_id || track.title}__${track.title}__${track.artist}__${index}`;
}

function normalizeState(
  raw: Partial<PlaylistManagerState>,
): PlaylistManagerState {
  const base = emptyState();
  return {
    ...base,
    ...raw,
    savedMasterPlaylists: Array.isArray(raw.savedMasterPlaylists)
      ? raw.savedMasterPlaylists
      : [],
    masterCurationBoxes: Array.isArray(raw.masterCurationBoxes)
      ? raw.masterCurationBoxes
      : [],
    syncedPlaylists: Array.isArray(raw.syncedPlaylists)
      ? raw.syncedPlaylists.map((playlist) => ({
          ...playlist,
          checked: true,
        }))
      : [],
    masterPlaylistSyncHistory: Array.isArray(raw.masterPlaylistSyncHistory)
      ? raw.masterPlaylistSyncHistory
      : [],
  };
}

function loadStateFromLocalStorage(): PlaylistManagerState {
  if (typeof window === "undefined") return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

function saveStateToLocalStorage(state: PlaylistManagerState) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.localStorage.setItem(
    "master_playlists",
    JSON.stringify(state.savedMasterPlaylists),
  );
}

async function loadStateFromDatabase(): Promise<PlaylistManagerState | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/playlist-manager-state?user_key=${encodeURIComponent(
      PLAYLIST_MANAGER_USER_KEY,
    )}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to load playlist manager state.");
  }

  const data = await response.json();

  if (!data?.state) return null;

  return normalizeState(data.state);
}

async function saveStateToDatabase(state: PlaylistManagerState) {
  const response = await fetch(`${API_BASE_URL}/api/playlist-manager-state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_key: PLAYLIST_MANAGER_USER_KEY,
      state,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save playlist manager state.");
  }

  return response.json();
}

function extractSpotifyTrackId(input: string) {
  const trimmed = input.trim();
  const directMatch = trimmed.match(/track\/([a-zA-Z0-9]+)(\?|$|\/)/);
  if (directMatch?.[1]) return directMatch[1];

  const uriMatch = trimmed.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  return null;
}

function extractStoredSpotifyTrackId(value: string | null | undefined) {
  const clean = String(value || "").trim();
  if (!clean) return null;

  return (
    extractSpotifyTrackId(clean) ||
    (/^[a-zA-Z0-9]{15,40}$/.test(clean) ? clean : null)
  );
}

function extractSpotifyAlbumId(input: string) {
  const trimmed = input.trim();
  const directMatch = trimmed.match(/album\/([a-zA-Z0-9]+)(\?|$|\/)/);
  if (directMatch?.[1]) return directMatch[1];

  const uriMatch = trimmed.match(/^spotify:album:([a-zA-Z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  return null;
}

function isSpotifyUrl(value: string) {
  return /^https?:\/\/(?:open\.)?spotify\.com\//i.test(value.trim());
}
function extractSpotifyPlaylistId(input: string) {
  const trimmed = input.trim().replace(/^"|"$/g, "");
  if (!trimmed) return null;

  const directMatch = trimmed.match(/playlist\/([a-zA-Z0-9]+)(\?|$|\/)/);
  if (directMatch?.[1]) return directMatch[1];

  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  // New CSV format: raw Spotify playlist ID, no URL.
  const rawIdMatch = trimmed.match(/^[a-zA-Z0-9]{15,40}$/);
  if (rawIdMatch) return trimmed;

  return null;
}




function parseSpotifyOembedTitle(rawTitle: string, spotifyId: string) {
  const clean = rawTitle
    .replace(/\s*\|\s*Spotify\s*$/i, "")
    .replace(/\s+-\s+song and lyrics by\s+/i, " - ")
    .replace(/\s+-\s+song by\s+/i, " - ")
    .replace(/\s+-\s+track by\s+/i, " - ")
    .replace(/\s+-\s+single by\s+/i, " - ")
    .replace(/\s+-\s+album by\s+/i, " - ")
    .replace(/\s+-\s+ep by\s+/i, " - ")
    .replace(/\s+by\s+/i, " - ")
    .trim();

  if (!clean) {
    return {
      title: `Spotify Track ${spotifyId}`,
      artist: "",
    };
  }

  const parts = clean.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      title: parts[0].trim() || `Spotify Track ${spotifyId}`,
      artist: parts.slice(1).join(" - ").trim(),
    };
  }

  return {
    title: clean,
    artist: "",
  };
}

async function resolveSpotifyDisplayMetadata(
  spotifyUrl: string,
  fallbackId: string,
) {
  try {
    const response = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
    };

    const parsed = parseSpotifyOembedTitle(data.title || "", fallbackId);

    return {
      title: parsed.title,
      artist: parsed.artist || String(data.author_name || "").trim(),
    };
  } catch {
    return null;
  }
}

async function parseTrackInput(input: string): Promise<AddedTrack | null> {
  const clean = input.trim();

  if (!clean) return null;

  const spotifyId = extractSpotifyTrackId(clean);
  const spotifyAlbumId = extractSpotifyAlbumId(clean);

  if (spotifyId) {
    const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`;
    const parsedTitle = await resolveSpotifyDisplayMetadata(spotifyUrl, spotifyId);

    return {
      id: spotifyId,
      spotify_id: spotifyId,
      title: parsedTitle?.title || `Spotify Track ${spotifyId}`,
      artist: parsedTitle?.artist || "",
      createdAt: new Date().toISOString(),
    };
  }

  if (spotifyAlbumId || isSpotifyUrl(clean)) {
    return null;
  }

  const split = clean.split(/\s+-\s+/);

  return {
    id: `typed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    spotify_id: null,
    title: split[0]?.trim() || clean,
    artist: split.slice(1).join(" - ").trim(),
    createdAt: new Date().toISOString(),
  };
}

function insertAtPosition<T>(items: T[], item: T, position: number | string): T[] {
  const next = [...items];
  const parsedPosition = typeof position === "string" ? Number.parseInt(position, 10) : position;
  const safePosition = Number.isFinite(parsedPosition) ? Math.max(1, Math.floor(parsedPosition)) : next.length + 1;
  const index = Math.min(Math.max(safePosition - 1, 0), next.length);
  next.splice(index, 0, item);
  return next;
}

function reorderTracks<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function reorderSelectedTracks<T>(
  items: T[],
  selectedIndexes: number[],
  draggedIndex: number,
  targetIndex: number,
): T[] {
  const uniqueSelectedIndexes = Array.from(new Set(selectedIndexes)).sort((a, b) => a - b);

  if (
    draggedIndex < 0 ||
    targetIndex < 0 ||
    draggedIndex >= items.length ||
    targetIndex >= items.length ||
    uniqueSelectedIndexes.length === 0
  ) {
    return items;
  }

  if (uniqueSelectedIndexes.length === 1) {
    return reorderTracks(items, draggedIndex, targetIndex);
  }

  const selectedSet = new Set(uniqueSelectedIndexes);
  const selectedItems = uniqueSelectedIndexes.map((index) => items[index]);
  const remainingItems = items.filter((_, index) => !selectedSet.has(index));
  const selectedBeforeTarget = uniqueSelectedIndexes.filter((index) => index < targetIndex).length;
  const insertionIndex = Math.max(
    0,
    Math.min(targetIndex - selectedBeforeTarget, remainingItems.length),
  );

  const next = [...remainingItems];
  next.splice(insertionIndex, 0, ...selectedItems);

  return next;
}

function normalizeDraftTrack(track: Record<string, unknown>) {
  const source = track as Record<string, unknown>;

  const id =
    String(source.id ?? source.spotify_id ?? source.spotifyId ?? source.uri ?? `draft-${Date.now()}-${Math.random()}`);

  const title =
    String(source.title ?? source.name ?? source.track_name ?? source.trackName ?? "Untitled Track");

  const artist =
    String(source.artist ?? source.artist_name ?? source.artistName ?? "");

  const imageUrlValue =
    source.image_url ?? source.imageUrl ?? source.album_image_url ?? source.albumImageUrl ?? null;

  const spotifyUrlValue =
    source.spotify_url ?? source.spotifyUrl ?? source.external_url ?? source.externalUrl ?? null;

  return {
    id,
    spotify_id: source.spotify_id ? String(source.spotify_id) : undefined,
    title,
    name: title,
    artist,
    artist_name: artist,
    album_name: source.album_name ? String(source.album_name) : undefined,
    image_url: imageUrlValue ? String(imageUrlValue) : null,
    spotify_url: spotifyUrlValue ? String(spotifyUrlValue) : null,
  };
}


function normalizeTextForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function smartPlaylistSortKey(value: string) {
  return normalizeTextForMatch(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[|•·–—_()[\]{}.,:;'"`~!?]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const playlistNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

function smartPlaylistCompare(
  first: SavedMasterPlaylistOption,
  second: SavedMasterPlaylistOption,
) {
  const firstKey = smartPlaylistSortKey(first.name);
  const secondKey = smartPlaylistSortKey(second.name);
  const primary = playlistNameCollator.compare(firstKey, secondKey);

  if (primary !== 0) return primary;

  return playlistNameCollator.compare(first.name, second.name);
}

function findPlaylistByLink(playlists: FlatPlaylistItem[], value: string) {
  const clean = value.trim();
  const spotifyPlaylistId = extractSpotifyPlaylistId(clean);
  const normalizedClean = normalizeTextForMatch(clean);

  return playlists.find((playlist) => {
    const spotifyUrl = playlist.spotify_url || "";
    const spotifyId =
      playlist.spotify_id ||
      playlist.spotify_playlist_id ||
      extractSpotifyPlaylistId(spotifyUrl);

    return (
      (spotifyPlaylistId
        ? spotifyUrl.includes(spotifyPlaylistId) || spotifyId === spotifyPlaylistId
        : false) ||
      String(playlist.id) === clean ||
      normalizeTextForMatch(playlist.name) === normalizedClean
    );
  });
}

function buildSpotifyPlaylistUrlFromId(value: string | null | undefined) {
  const playlistId = value ? extractSpotifyPlaylistId(value) || String(value).trim() : "";

  if (!playlistId) return null;

  return `https://open.spotify.com/playlist/${playlistId}`;
}

function getSyncedPlaylistSpotifyUrl(
  playlist: SyncedPlaylistItem,
  allPlaylists: FlatPlaylistItem[],
) {
  const storedUrl = playlist.spotifyUrl || "";
  const storedId = playlist.spotifyId || extractSpotifyPlaylistId(storedUrl);

  if (storedUrl) return storedUrl;
  if (storedId) return buildSpotifyPlaylistUrlFromId(storedId);

  const matched = allPlaylists.find((item) => {
    return (
      Number(item.id) === Number(playlist.playlistId) &&
      Number(item.accountId) === Number(playlist.accountId)
    );
  });

  const matchedUrl = matched?.spotify_url || "";
  const matchedId =
    matched?.spotify_id ||
    matched?.spotify_playlist_id ||
    extractSpotifyPlaylistId(matchedUrl);

  return matchedUrl || buildSpotifyPlaylistUrlFromId(matchedId);
}

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function detectCsvDelimiter(content: string) {
  const firstLine = content.replace(/^\uFEFF/, "").split(/\r?\n/)[0] || "";
  const options = [",", ";", "\t"];
  return options.reduce((best, option) => {
    const count = firstLine.split(option).length;
    return count > firstLine.split(best).length ? option : best;
  }, ",");
}

function parseCsvRecords(content: string) {
  const delimiter = detectCsvDelimiter(content);
  const records: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  const text = content.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && nextChar === '"' && inQuotes) {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(current.trim());
      current = "";
      if (row.some((value) => value.trim())) records.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((value) => value.trim())) records.push(row);
  return records;
}

function parseCsvContent(content: string) {
  const records = parseCsvRecords(content);
  if (records.length < 2) return [];
  const headers = records[0].map(normalizeCsvHeader);
  return records.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      const fallbackHeader = `column_${index + 1}`;
      row[header || fallbackHeader] = values[index] || "";
      row[fallbackHeader] = values[index] || "";
    });
    return { row, values };
  });
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function findPlaylistForCsv(
  playlists: FlatPlaylistItem[],
  value: string,
  accountName?: string,
) {
  const importedId = extractSpotifyPlaylistId(value);
  const cleanValue = value.trim();
  const accountClean = accountName ? normalizeTextForMatch(accountName) : "";

  if (!importedId && !cleanValue) return null;

  const candidates = accountClean
    ? playlists.filter((playlist) => {
        const playlistAccount = normalizeTextForMatch(playlist.accountName || "");
        return (
          playlistAccount === accountClean ||
          playlistAccount.includes(accountClean) ||
          accountClean.includes(playlistAccount)
        );
      })
    : playlists;

  const matchFrom = (list: FlatPlaylistItem[]) =>
    list.find((playlist) => {
      const possibleIds = [
        playlist.spotify_id,
        playlist.spotify_playlist_id,
        String(playlist.id || ""),
        extractSpotifyPlaylistId(playlist.spotify_url || ""),
        extractSpotifyPlaylistId((playlist as { external_url?: string }).external_url || ""),
      ].filter(Boolean);

      return importedId
        ? possibleIds.includes(importedId)
        : normalizeTextForMatch(playlist.name || "") === normalizeTextForMatch(cleanValue);
    }) || null;

  return matchFrom(candidates) || matchFrom(playlists);
}
function stableExternalPlaylistNumber(value: string) {
  const key = extractSpotifyPlaylistId(value) || normalizeTextForMatch(value);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return -1 * (hash || Date.now());
}

function findAccountIdByCsvName(accounts: AccountItem[], accountName: string) {
  const clean = normalizeTextForMatch(accountName);
  if (!clean) return 0;

  const account = accounts.find((item) => {
    const accountDisplayName = normalizeTextForMatch(item.display_name || "");
    return (
      accountDisplayName === clean ||
      accountDisplayName.includes(clean) ||
      clean.includes(accountDisplayName)
    );
  });

  return account?.id || 0;
}

function buildCsvPlaylistName(
  fallbackName: string,
  matchedPlaylist: FlatPlaylistItem | null,
  accountName: string,
  urlOrName: string,
) {
  const cleanFallback = fallbackName.trim();
  const cleanAccount = normalizeTextForMatch(accountName);
  const matchedName = matchedPlaylist?.name?.trim() || "";
  const spotifyId = extractSpotifyPlaylistId(urlOrName);

  // Real backend playlist name always wins when available.
  if (matchedName && normalizeTextForMatch(matchedName) !== cleanAccount) {
    return matchedName;
  }

  // Column C / explicit names win, but never use the account name as playlist title.
  if (cleanFallback && normalizeTextForMatch(cleanFallback) !== cleanAccount) {
    return cleanFallback;
  }

  // If the CSV cell is only a Spotify URL and it is not matched in backend yet,
  // show a neutral playlist title instead of repeating the account name.
  if (spotifyId) {
    return `Playlist ${spotifyId.slice(0, 8)}`;
  }

  return cleanFallback || "Imported Playlist";
}

function makeExternalPlaylistFromCsv(
  value: string,
  fallbackName: string,
  accountId: number,
  accountName: string,
  matchedPlaylist: FlatPlaylistItem | null = null,
): FlatPlaylistItem | null {
  const clean = value.trim();
  const playlistId = extractSpotifyPlaylistId(clean);
  const name = buildCsvPlaylistName(fallbackName, matchedPlaylist, accountName, clean || fallbackName);

  if (!name && !playlistId) return null;

  const stableId = matchedPlaylist?.id ?? stableExternalPlaylistNumber(clean || name);

  return {
    id: stableId,
    playlistId: stableId,
    accountId: matchedPlaylist?.accountId ?? accountId,
    accountName: matchedPlaylist?.accountName ?? (accountName || "CSV Account"),
    name,
    image_url: matchedPlaylist?.image_url ?? null,
    spotify_url: clean,
    spotify_id: playlistId || matchedPlaylist?.spotify_id || null,
    spotify_playlist_id: playlistId || matchedPlaylist?.spotify_playlist_id || null,
    tracks_count: matchedPlaylist?.tracks_count ?? 0,
  };
}

function getCsvValue(row: Record<string, string>, values: string[], keys: string[], fallbackIndex: number) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }

  return (values[fallbackIndex] || "").trim();
}

function splitCsvPlaylistReferences(value: string) {
  const clean = value.trim();
  if (!clean) return [];

  const spotifyUrls = clean.match(/https?:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?[^,\s;]*)?/g);
  if (spotifyUrls?.length) return spotifyUrls;

  const spotifyUris = clean.match(/spotify:playlist:[A-Za-z0-9]+/g);
  if (spotifyUris?.length) return spotifyUris;

  // Supports the new faster CSV format with raw playlist IDs.
  // Also supports multiple IDs pasted in one cell separated by commas, semicolons, spaces, or new lines.
  return clean
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && Boolean(extractSpotifyPlaylistId(item)));
}

function getSyncedCsvValues(row: Record<string, string>, values: string[]) {
  const byPosition = values
    .slice(3)
    .flatMap(splitCsvPlaylistReferences)
    .map((value) => value.trim())
    .filter(Boolean);

  const byHeader = Object.entries(row)
    .filter(([key]) => {
      const normalizedKey = normalizeCsvHeader(key);
      return (
        normalizedKey.startsWith("synced_playlist_") ||
        normalizedKey.startsWith("synced_playlists") ||
        normalizedKey.startsWith("synced_") ||
        normalizedKey.includes("syncedplaylist")
      );
    })
    .flatMap(([, value]) => splitCsvPlaylistReferences(value))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...byPosition, ...byHeader]));
}


export default function PlaylistManagerPage() {
  const [state, setState] = useState<PlaylistManagerState>(() => emptyState());
  const [hydrated, setHydrated] = useState(false);
  const [pageMessage, setPageMessage] = useState("");
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [importPlaylistLink, setImportPlaylistLink] = useState("");
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [addTrackInput, setAddTrackInput] = useState("");
  const [placementNumber, setPlacementNumber] = useState("");
  const [addTrackMode, setAddTrackMode] = useState<AddTrackMode>("current");
  const [trackDragIndex, setTrackDragIndex] = useState<number | null>(null);
  const [selectedTrackKeys, setSelectedTrackKeys] = useState<Set<string>>(() => new Set());
  const [lastSelectedTrackIndex, setLastSelectedTrackIndex] = useState<number | null>(null);
  const [trackUndoStack, setTrackUndoStack] = useState<AddedTrack[][]>([]);
  const [syncProgress, setSyncProgress] = useState<Record<string, number>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
  const [isRefreshingNames, setIsRefreshingNames] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const accountsQuery = useQuery<AccountItem[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const accounts = accountsQuery.data ?? [];

  const playlistsQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ["playlists", account.id],
      queryFn: () => getPlaylists(account.id),
      enabled: accounts.length > 0,
    })),
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrateState() {
      const localState = loadStateFromLocalStorage();

      try {
        const databaseState = await loadStateFromDatabase();
        const loaded = databaseState ?? localState;

        if (cancelled) return;

        setState(loaded);
        saveStateToLocalStorage(loaded);
      } catch {
        if (cancelled) return;
        setState(localState);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    hydrateState();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistState = (nextState: PlaylistManagerState) => {
    setState(nextState);
    saveStateToLocalStorage(nextState);

    saveStateToDatabase(nextState).catch(() => {
      setPageMessage(
        "Saved locally, but database save failed. Check backend connection.",
      );
    });
  };


  useEffect(() => {
    if (!hydrated) return;

    const missingArtistRows = state.masterCurationBoxes.flatMap((box) =>
      box.tracks
        .map((track, index) => ({ boxId: box.id, track, index }))
        .filter(
          ({ track }) =>
            Boolean(
              track.spotify_id ||
                extractStoredSpotifyTrackId(track.id) ||
                extractStoredSpotifyTrackId(track.title),
            ) &&
            !String(track.artist || "").trim(),
        ),
    );

    if (missingArtistRows.length === 0) return;

    let cancelled = false;

    async function repairMissingArtists() {
      const resolved = await Promise.all(
        missingArtistRows.map(async ({ boxId, track, index }) => {
          const spotifyId =
            track.spotify_id ||
            extractStoredSpotifyTrackId(track.id) ||
            extractStoredSpotifyTrackId(track.title);

          if (!spotifyId) {
            return { boxId, index, spotifyId: null, metadata: null };
          }

          const metadata = await resolveSpotifyDisplayMetadata(
            `https://open.spotify.com/track/${spotifyId}`,
            spotifyId,
          );

          return { boxId, index, spotifyId, metadata };
        }),
      );

      if (cancelled) return;

      let changed = false;

      const nextBoxes = state.masterCurationBoxes.map((box) => {
        const repairs = resolved.filter((item) => item.boxId === box.id);
        if (repairs.length === 0) return box;

        const tracks = box.tracks.map((track, index) => {
          const repair = repairs.find((item) => item.index === index);
          if (!repair?.metadata?.artist) return track;

          changed = true;

          return {
            ...track,
            id: repair.spotifyId || track.id,
            spotify_id: repair.spotifyId || track.spotify_id || null,
            title: repair.metadata.title || track.title,
            artist: repair.metadata.artist,
          };
        });

        return { ...box, tracks };
      });

      if (!changed) return;

      const nextState = {
        ...state,
        masterCurationBoxes: nextBoxes,
      };

      setState(nextState);
      saveStateToLocalStorage(nextState);
      saveStateToDatabase(nextState).catch(() => undefined);
    }

    void repairMissingArtists();

    return () => {
      cancelled = true;
    };
  }, [hydrated, state.masterCurationBoxes]);

  const handleClearAllPlaylistManager = () => {
    const confirmed = window.confirm(
      "Clear all Playlist Manager data?\n\nThis will remove all saved master playlists, synced playlists, curation boxes, and local saved state. It will NOT delete anything from Spotify.",
    );

    if (!confirmed) return;

    const nextState = emptyState();
    setSyncProgress({});
    setSyncStatus({});
    persistState(nextState);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("master_playlists");
    window.localStorage.removeItem(CURATION_DRAFT_KEY);
    setPageMessage("Playlist Manager cleared. You can import again now.");
  };

  const allPlaylists = useMemo<FlatPlaylistItem[]>(() => {
    return playlistsQueries.flatMap((query, index) => {
      const account = accounts[index];
      const items = query.data ?? [];
      return items.map((playlist) => ({
        ...playlist,
        accountId: playlist.account_id ?? account.id,
        accountName: account.display_name || `Account ${account.id}`,
      }));
    });
  }, [accounts, playlistsQueries]);

  const reconcileSavedPlaylistNames = (
    currentState: PlaylistManagerState,
    currentPlaylists: FlatPlaylistItem[],
  ) => {
    if (currentPlaylists.length === 0) return currentState;

    const findCurrentPlaylist = (
      playlistId: number,
      accountId: number,
      spotifyId?: string | null,
    ) =>
      currentPlaylists.find(
        (item) =>
          Number(item.id) === Number(playlistId) &&
          Number(item.accountId) === Number(accountId),
      ) ??
      (spotifyId
        ? currentPlaylists.find(
            (item) =>
              Number(item.accountId) === Number(accountId) &&
              (item.spotify_id === spotifyId ||
                item.spotify_playlist_id === spotifyId),
          )
        : undefined);

    let changed = false;

    const savedMasterPlaylists = currentState.savedMasterPlaylists.map((saved) => {
      const current = findCurrentPlaylist(saved.playlistId, saved.accountId);
      if (!current) return saved;

      const nextName = current.name || saved.name;
      const nextImageUrl = current.image_url ?? saved.imageUrl;
      const nextTracks = current.tracks_count ?? saved.tracks;

      if (
        nextName !== saved.name ||
        nextImageUrl !== saved.imageUrl ||
        nextTracks !== saved.tracks
      ) {
        changed = true;
        return {
          ...saved,
          name: nextName,
          imageUrl: nextImageUrl,
          tracks: nextTracks,
        };
      }

      return saved;
    });

    const syncedPlaylists = currentState.syncedPlaylists.map((saved) => {
      const savedSpotifyId =
        saved.spotifyId || extractSpotifyPlaylistId(saved.spotifyUrl || "");
      const current = findCurrentPlaylist(
        saved.playlistId,
        saved.accountId,
        savedSpotifyId,
      );
      if (!current) return saved;

      const nextName = current.name || saved.name;
      const nextImageUrl = current.image_url ?? saved.imageUrl;
      const nextSpotifyUrl = current.spotify_url ?? saved.spotifyUrl;
      const nextSpotifyId =
        current.spotify_id ||
        current.spotify_playlist_id ||
        saved.spotifyId ||
        null;

      if (
        nextName !== saved.name ||
        nextImageUrl !== saved.imageUrl ||
        nextSpotifyUrl !== saved.spotifyUrl ||
        nextSpotifyId !== saved.spotifyId
      ) {
        changed = true;
        return {
          ...saved,
          name: nextName,
          imageUrl: nextImageUrl,
          spotifyUrl: nextSpotifyUrl,
          spotifyId: nextSpotifyId,
        };
      }

      return saved;
    });

    if (!changed) return currentState;

    const selectedMaster =
      savedMasterPlaylists.find(
        (item) => item.id === currentState.selectedSavedMasterPlaylistId,
      ) ?? null;

    return {
      ...currentState,
      savedMasterPlaylists,
      syncedPlaylists,
      masterPlaylistName: selectedMaster?.name ?? currentState.masterPlaylistName,
      masterPlaylistImageUrl:
        selectedMaster?.imageUrl ?? currentState.masterPlaylistImageUrl,
    };
  };

  useEffect(() => {
    if (!hydrated || allPlaylists.length === 0) return;

    setState((current) => {
      const next = reconcileSavedPlaylistNames(current, allPlaylists);
      if (next === current) return current;

      saveStateToLocalStorage(next);
      saveStateToDatabase(next).catch(() => undefined);
      return next;
    });
  }, [hydrated, allPlaylists]);

  const handleRefreshPlaylistNames = async () => {
    if (isRefreshingNames || accounts.length === 0) return;

    setIsRefreshingNames(true);
    setPageMessage("Refreshing playlist names from Spotify...");

    try {
      for (const account of accounts) {
        const response = await fetch(
          `${API_BASE_URL}/api/accounts/${account.id}/playlists/sync?limit=500&offset=0`,
          {
            method: "POST",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Could not refresh ${account.display_name || `Account ${account.id}`}: ${body}`,
          );
        }
      }

      await Promise.all(
        playlistsQueries.map((query) => query.refetch()),
      );

      setPageMessage(
        "Playlist names refreshed from Spotify. Renamed playlists are now updated.",
      );
    } catch (error) {
      setPageMessage(
        error instanceof Error
          ? error.message
          : "Failed to refresh playlist names.",
      );
    } finally {
      setIsRefreshingNames(false);
    }
  };

  const selectedMaster = useMemo(() => {
    if (!state.selectedSavedMasterPlaylistId) return null;
    return (
      state.savedMasterPlaylists.find(
        (item) => item.id === state.selectedSavedMasterPlaylistId,
      ) ?? null
    );
  }, [state.savedMasterPlaylists, state.selectedSavedMasterPlaylistId]);

  const selectedCurationBox = useMemo(() => {
    if (!state.selectedSavedMasterPlaylistId) return null;

    return (
      state.masterCurationBoxes
        .filter(
          (box) => box.masterPlaylistId === state.selectedSavedMasterPlaylistId,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] ?? null
    );
  }, [state.masterCurationBoxes, state.selectedSavedMasterPlaylistId]);

  const visibleSyncedPlaylists = useMemo(() => {
    if (!state.selectedSavedMasterPlaylistId) return [];
    return state.syncedPlaylists.filter(
      (playlist) =>
        !playlist.masterPlaylistId ||
        playlist.masterPlaylistId === state.selectedSavedMasterPlaylistId,
    );
  }, [state.syncedPlaylists, state.selectedSavedMasterPlaylistId]);

  const visibleSelectedCount = visibleSyncedPlaylists.filter(
    (playlist) => playlist.checked,
  ).length;

  const importedSyncedCount = visibleSyncedPlaylists.length;

  const sortedSavedMasterPlaylists = useMemo(() => {
    return [...state.savedMasterPlaylists].sort(smartPlaylistCompare);
  }, [state.savedMasterPlaylists]);

  const selectedTrackCount = useMemo(() => {
    if (!selectedCurationBox) return 0;
    return selectedCurationBox.tracks.filter((track, index) =>
      selectedTrackKeys.has(makeCurationTrackKey(track, index)),
    ).length;
  }, [selectedCurationBox, selectedTrackKeys]);

  useEffect(() => {
    setSelectedTrackKeys(new Set());
    setLastSelectedTrackIndex(null);
  }, [selectedCurationBox?.id]);

  useEffect(() => {
    if (!hydrated) return;

    const interval = window.setInterval(() => {
      const raw = window.localStorage.getItem(CURATION_DRAFT_KEY);
      if (!raw) return;

      try {
        const draft = JSON.parse(raw) as CurationDraft;
        const targetMasterId = draft.target_master_playlist_id;
        const tracks = (draft.tracks ?? []).map((track) => normalizeDraftTrack(track as Record<string, unknown>));

        if (!targetMasterId || tracks.length === 0) return;

        setState((current) => {
          const existingSameDraft = current.masterCurationBoxes.some(
            (box) =>
              box.masterPlaylistId === targetMasterId &&
              box.createdAt === draft.created_at &&
              box.tracks.length === tracks.length,
          );

          if (existingSameDraft) return current;

          const targetMasterName =
            draft.target_master_playlist_name ||
            current.savedMasterPlaylists.find((playlist) => playlist.id === targetMasterId)?.name ||
            draft.curation_name ||
            "Curation Draft";

          const nextBox: MasterCurationBox = {
            id: makeId("curation-box"),
            masterPlaylistId: targetMasterId,
            curationName: targetMasterName,
            createdAt: draft.created_at || new Date().toISOString(),
            tracks,
          };

          const nextState = {
            ...current,
            selectedSavedMasterPlaylistId: targetMasterId,
            masterCurationBoxes: [
              nextBox,
              ...current.masterCurationBoxes.filter(
                (box) => box.masterPlaylistId !== targetMasterId,
              ),
            ],
          };

          saveStateToLocalStorage(nextState);
          saveStateToDatabase(nextState).catch(() => undefined);
          return nextState;
        });
      } catch {
        return;
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [hydrated]);

  const syncMasterMetaFromSelection = (
    master: SavedMasterPlaylistOption | null,
  ) => {
    if (!master) {
      return {
        masterPlaylistId: null,
        masterPlaylistAccountId: null,
        masterPlaylistName: "",
        masterPlaylistImageUrl: null,
      };
    }

    return {
      masterPlaylistId: master.playlistId,
      masterPlaylistAccountId: master.accountId,
      masterPlaylistName: master.name,
      masterPlaylistImageUrl: master.imageUrl,
    };
  };

  const handleSelectMaster = (id: string) => {
    const master =
      state.savedMasterPlaylists.find((item) => item.id === id) ?? null;
    persistState({
      ...state,
      selectedSavedMasterPlaylistId: master?.id ?? null,
      ...syncMasterMetaFromSelection(master),
    });
  };

  const handleImportPlaylist = () => {
    if (!importMode) return;

    if (!importPlaylistLink.trim()) {
      setPageMessage("Paste a Spotify playlist link first.");
      return;
    }

    const selected = findPlaylistByLink(allPlaylists, importPlaylistLink);

    if (!selected) {
      setPageMessage(
        "Playlist was not found in synced accounts. Sync accounts first, then paste the Spotify playlist link again.",
      );
      return;
    }

    if (importMode === "master") {
      const existing = state.savedMasterPlaylists.find(
        (item) =>
          item.playlistId === selected.id &&
          item.accountId === selected.accountId,
      );

      const master: SavedMasterPlaylistOption = existing ?? {
        id: makeId("master-playlist"),
        playlistId: selected.id,
        accountId: selected.accountId,
        name: selected.name,
        imageUrl: selected.image_url ?? null,
        tracks: selected.tracks_count ?? 0,
        createdAt: new Date().toISOString(),
      };

      const savedMasterPlaylists = existing
        ? state.savedMasterPlaylists
        : [master, ...state.savedMasterPlaylists];

      persistState({
        ...state,
        savedMasterPlaylists,
        selectedSavedMasterPlaylistId: master.id,
        ...syncMasterMetaFromSelection(master),
      });

      setPageMessage(`${selected.name} imported as master playlist.`);
    }

    if (importMode === "synced") {
      if (!state.selectedSavedMasterPlaylistId) {
        setPageMessage("Select or import a master playlist first.");
        return;
      }
      const exists = state.syncedPlaylists.some(
        (item) =>
          item.masterPlaylistId === state.selectedSavedMasterPlaylistId &&
          item.playlistId === selected.id &&
          item.accountId === selected.accountId,
      );

      if (exists) {
        setPageMessage("This synced playlist is already imported.");
      } else {
        persistState({
          ...state,
          syncedPlaylists: [
            ...state.syncedPlaylists,
            {
              id: makeId("synced-playlist"),
              masterPlaylistId: state.selectedSavedMasterPlaylistId,
              playlistId: selected.id,
              accountId: selected.accountId,
              name: selected.name,
              imageUrl: selected.image_url ?? null,
              spotifyUrl: selected.spotify_url ?? null,
              spotifyId:
                selected.spotify_id ||
                selected.spotify_playlist_id ||
                extractSpotifyPlaylistId(selected.spotify_url || ""),
              checked: true,
              lastSyncedAt: null,
            },
          ],
        });
        setPageMessage(`${selected.name} imported as synced playlist.`);
      }
    }

    setImportMode(null);
    setImportPlaylistLink("");
  };

  const handleDownloadCsvTemplate = () => {
    const masters = state.savedMasterPlaylists;

    if (masters.length === 0) {
      setPageMessage(
        "No saved master playlists are available to export.",
      );
      return;
    }

    const syncedByMaster = new Map<string, SyncedPlaylistItem[]>();

    masters.forEach((master) => {
      syncedByMaster.set(
        master.id,
        state.syncedPlaylists.filter(
          (playlist) => playlist.masterPlaylistId === master.id,
        ),
      );
    });

    const maxSyncedColumns = Math.max(
      1,
      ...Array.from(syncedByMaster.values()).map(
        (playlists) => playlists.length,
      ),
    );

    const headers = [
      "account_name",
      "master_playlist_id",
      "master_playlist_name",
      ...Array.from(
        { length: maxSyncedColumns },
        (_, index) => `synced_playlist_${index + 1}`,
      ),
    ];

    const rows = masters.map((master) => {
      const matchedMaster = allPlaylists.find(
        (playlist) =>
          Number(playlist.id) === Number(master.playlistId) &&
          Number(playlist.accountId) === Number(master.accountId),
      );

      const masterSpotifyId =
        matchedMaster?.spotify_id ||
        matchedMaster?.spotify_playlist_id ||
        extractSpotifyPlaylistId(matchedMaster?.spotify_url || "") ||
        String(master.playlistId);

      const accountName =
        accounts.find((account) => account.id === master.accountId)
          ?.display_name ||
        matchedMaster?.accountName ||
        `Account ${master.accountId}`;

      const syncedIds = (syncedByMaster.get(master.id) || []).map(
        (playlist) => {
          const matchedSynced = allPlaylists.find(
            (item) =>
              Number(item.id) === Number(playlist.playlistId) &&
              Number(item.accountId) === Number(playlist.accountId),
          );

          return (
            playlist.spotifyId ||
            extractSpotifyPlaylistId(playlist.spotifyUrl || "") ||
            matchedSynced?.spotify_id ||
            matchedSynced?.spotify_playlist_id ||
            extractSpotifyPlaylistId(matchedSynced?.spotify_url || "") ||
            String(playlist.playlistId)
          );
        },
      );

      return [
        accountName,
        masterSpotifyId,
        master.name,
        ...Array.from(
          { length: maxSyncedColumns },
          (_, index) => syncedIds[index] || "",
        ),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    downloadTextFile(
      `playlist_manager_export_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );

    const totalSynced = Array.from(syncedByMaster.values()).reduce(
      (total, playlists) => total + playlists.length,
      0,
    );

    setPageMessage(
      `Exported ${masters.length} master playlist(s) and ${totalSynced} synced playlist(s).`,
    );
  };

  const handleImportCsvFile = async (file: File | null) => {
    if (!file) return;
    try {
      const content = await file.text();
      const parsedRows = parseCsvContent(content);
      if (parsedRows.length === 0) {
        setPageMessage("CSV is empty or missing rows.");
        return;
      }
      let importedMasters = 0;
      let importedSynced = 0;
      let skipped = 0;
      const nextState: PlaylistManagerState = {
        ...state,
        savedMasterPlaylists: [...state.savedMasterPlaylists],
        syncedPlaylists: [...state.syncedPlaylists],
      };

      parsedRows.forEach(({ row, values }) => {
        const accountName = getCsvValue(
          row,
          values,
          ["account_name", "account_nam", "account", "accountname"],
          0,
        );
        const csvAccountId = findAccountIdByCsvName(accounts, accountName);
        const masterUrl = getCsvValue(
          row,
          values,
          [
            "master_playlist_id",
            "masterplaylist_id",
            "masterplaylistid",
            "master_id",
            "masterplaylist_url",
            "master_playlist_url",
            "masterplaylisturl",
            "master_url",
            "master_link",
            "masterplaylistlink",
          ],
          1,
        );
        const masterName = getCsvValue(
          row,
          values,
          [
            "master_playlist",
            "masterplaylist",
            "master_playlist_name",
            "masterplaylist_name",
            "name",
            "title",
          ],
          2,
        );

        const matchedMaster =
          findPlaylistForCsv(allPlaylists, masterUrl, accountName) ||
          findPlaylistForCsv(allPlaylists, masterName, accountName);
        const masterPlaylist =
          makeExternalPlaylistFromCsv(
            masterUrl || masterName,
            masterName,
            csvAccountId,
            accountName,
            matchedMaster,
          ) || matchedMaster;

        if (!masterPlaylist) {
          skipped += 1;
          return;
        }

        const masterDisplayName = buildCsvPlaylistName(
          masterName,
          matchedMaster ?? null,
          accountName,
          masterUrl || masterName,
        );

        let master = nextState.savedMasterPlaylists.find(
          (item) =>
            item.playlistId === masterPlaylist.id &&
            item.accountId === masterPlaylist.accountId,
        );
        if (!master) {
          master = {
            id: makeId("master-playlist"),
            playlistId: masterPlaylist.id,
            accountId: masterPlaylist.accountId,
            name: masterDisplayName,
            imageUrl: masterPlaylist.image_url ?? null,
            tracks: masterPlaylist.tracks_count ?? 0,
            createdAt: new Date().toISOString(),
          };
          nextState.savedMasterPlaylists.unshift(master);
          importedMasters += 1;
        } else if (master.name !== masterDisplayName && masterDisplayName) {
          master = { ...master, name: masterDisplayName };
          nextState.savedMasterPlaylists = nextState.savedMasterPlaylists.map((item) =>
            item.id === master?.id ? master : item,
          );
        }

        getSyncedCsvValues(row, values).forEach((syncedValue) => {
          const syncedSpotifyId = extractSpotifyPlaylistId(syncedValue);
          const masterSpotifyId = extractSpotifyPlaylistId(masterUrl);
          if (
            syncedSpotifyId &&
            masterSpotifyId &&
            syncedSpotifyId === masterSpotifyId
          ) {
            return;
          }

          const matchedSynced = findPlaylistForCsv(
            allPlaylists,
            syncedValue,
            accountName,
          );
          const syncedPlaylist =
            makeExternalPlaylistFromCsv(
              syncedValue,
              matchedSynced?.name || "",
              csvAccountId,
              accountName,
              matchedSynced ?? null,
            ) || matchedSynced;

          if (!syncedPlaylist) {
            skipped += 1;
            return;
          }
          const exists = nextState.syncedPlaylists.some(
            (item) =>
              item.masterPlaylistId === master?.id &&
              item.playlistId === syncedPlaylist.id &&
              item.accountId === syncedPlaylist.accountId,
          );
          if (exists) return;
          nextState.syncedPlaylists.push({
            id: makeId("synced-playlist"),
            masterPlaylistId: master.id,
            playlistId: syncedPlaylist.id,
            accountId: syncedPlaylist.accountId,
            name: syncedPlaylist.name,
            imageUrl: syncedPlaylist.image_url ?? null,
            spotifyUrl: syncedPlaylist.spotify_url ?? null,
            spotifyId:
              syncedPlaylist.spotify_id ||
              syncedPlaylist.spotify_playlist_id ||
              extractSpotifyPlaylistId(syncedPlaylist.spotify_url || syncedValue),
            checked: true,
            lastSyncedAt: null,
          });
          importedSynced += 1;
        });

        if (!nextState.selectedSavedMasterPlaylistId) {
          nextState.selectedSavedMasterPlaylistId = master.id;
          Object.assign(nextState, syncMasterMetaFromSelection(master));
        }
      });
      persistState(nextState);
      setPageMessage(
        importedMasters === 0 && importedSynced === 0
          ? `CSV imported, but no usable rows were found. Skipped: ${skipped}. Make sure columns are: account_name, master_playlist_id, master_playlist_name, then synced_playlist_1, synced_playlist_2, etc.`
          : `CSV imported. Masters: ${importedMasters}, synced playlists: ${importedSynced}, skipped: ${skipped}.`,
      );
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : "CSV import failed.",
      );
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const updateSelectedCurationTracks = (tracks: AddedTrack[]) => {
    if (!selectedCurationBox) return;

    persistState({
      ...state,
      masterCurationBoxes: state.masterCurationBoxes.map((box) =>
        box.id === selectedCurationBox.id ? { ...box, tracks } : box,
      ),
    });
  };

  const handleToggleCurationTrack = (trackIndex: number, shiftKey = false) => {
    if (!selectedCurationBox) return;

    const tracks = selectedCurationBox.tracks;
    const clickedKey = makeCurationTrackKey(tracks[trackIndex], trackIndex);

    setSelectedTrackKeys((current) => {
      const next = new Set(current);

      if (shiftKey && lastSelectedTrackIndex !== null) {
        const start = Math.min(lastSelectedTrackIndex, trackIndex);
        const end = Math.max(lastSelectedTrackIndex, trackIndex);
        for (let index = start; index <= end; index += 1) {
          next.add(makeCurationTrackKey(tracks[index], index));
        }
      } else if (next.has(clickedKey)) {
        next.delete(clickedKey);
      } else {
        next.add(clickedKey);
      }

      return next;
    });

    setLastSelectedTrackIndex(trackIndex);
  };

  const handleSelectAllCurationTracks = () => {
    if (!selectedCurationBox) return;

    setSelectedTrackKeys(
      new Set(
        selectedCurationBox.tracks.map((track, index) =>
          makeCurationTrackKey(track, index),
        ),
      ),
    );
    setLastSelectedTrackIndex(null);
  };

  const handleDeselectCurationTracks = () => {
    setSelectedTrackKeys(new Set());
    setLastSelectedTrackIndex(null);
  };

  const handleUndoCurationTrackDelete = () => {
    const previousTracks = trackUndoStack[trackUndoStack.length - 1];
    if (!previousTracks) return;

    updateSelectedCurationTracks(previousTracks);
    setTrackUndoStack((current) => current.slice(0, -1));
    handleDeselectCurationTracks();
    setPageMessage("Deleted curation tracks restored. Click Save to store this change.");
  };

  const handleDeleteSelectedCurationTracks = () => {
    if (!selectedCurationBox || selectedTrackCount === 0) return;

    const previousTracks = selectedCurationBox.tracks;
    const tracks = previousTracks.filter(
      (track, index) => !selectedTrackKeys.has(makeCurationTrackKey(track, index)),
    );

    setTrackUndoStack((current) => [...current, previousTracks]);
    updateSelectedCurationTracks(tracks);
    handleDeselectCurationTracks();
    setPageMessage(`${selectedTrackCount} selected curation track(s) deleted. Use Undo to restore them.`);
  };

  const handleRemoveTrack = (trackIndex: number) => {
    if (!selectedCurationBox) return;

    const previousTracks = selectedCurationBox.tracks;
    const tracks = previousTracks.filter(
      (_, index) => index !== trackIndex,
    );
    setTrackUndoStack((current) => [...current, previousTracks]);
    updateSelectedCurationTracks(tracks);
    handleDeselectCurationTracks();
  };

  const handleClearCurationTracks = () => {
    if (!selectedCurationBox || selectedCurationBox.tracks.length === 0) return;

    const confirmed = window.confirm(
      `Clear all songs from "${selectedCurationBox.curationName || "Manual Curation"}"?

This only clears the Playlist Manager curation list. It will not delete songs from Spotify until you sync/save to Spotify.`,
    );

    if (!confirmed) return;

    setTrackUndoStack((current) => [...current, selectedCurationBox.tracks]);
    updateSelectedCurationTracks([]);
    handleDeselectCurationTracks();
    setPageMessage("Curation tracks cleared. Use Undo to restore them, or click Save to store this change.");
  };

  const handleDropTrack = (targetIndex: number) => {
    if (!selectedCurationBox || trackDragIndex === null) return;

    const tracks = selectedCurationBox.tracks;
    const draggedKey = makeCurationTrackKey(tracks[trackDragIndex], trackDragIndex);
    const selectedIndexes = tracks
      .map((track, index) => ({
        index,
        key: makeCurationTrackKey(track, index),
      }))
      .filter((item) => selectedTrackKeys.has(item.key))
      .map((item) => item.index);
    const indexesToMove = selectedTrackKeys.has(draggedKey)
      ? selectedIndexes
      : [trackDragIndex];

    if (indexesToMove.length === 1 && trackDragIndex === targetIndex) {
      setTrackDragIndex(null);
      return;
    }

    const nextTracks = reorderSelectedTracks(
      tracks,
      indexesToMove,
      trackDragIndex,
      targetIndex,
    );

    setTrackUndoStack((current) => [...current, tracks]);
    updateSelectedCurationTracks(nextTracks);

    const movedTrackIds = new Set(indexesToMove.map((index) => tracks[index]?.id));
    setSelectedTrackKeys(
      new Set(
        nextTracks
          .map((track, index) => ({
            key: makeCurationTrackKey(track, index),
            isMoved: movedTrackIds.has(track.id),
          }))
          .filter((item) => item.isMoved)
          .map((item) => item.key),
      ),
    );
    setLastSelectedTrackIndex(null);
    setTrackDragIndex(null);
  };

  const handleSaveOrder = async () => {
    if (!state.masterPlaylistId || !state.masterPlaylistAccountId) {
      setPageMessage("Import a master playlist first.");
      return;
    }

    try {
      saveStateToLocalStorage(state);
      await saveStateToDatabase(state);

      if (!selectedCurationBox || selectedCurationBox.tracks.length === 0) {
        setPageMessage(
          "Playlist Manager saved. This master playlist has 0 curation tracks.",
        );
        return;
      }

      await replacePlaylistTracks(
        state.masterPlaylistAccountId,
        state.masterPlaylistId,
        selectedCurationBox.tracks.map((track) => ({
          id: track.spotify_id || track.id,
          spotify_id: track.spotify_id || track.id,
          title: track.title,
          artist: track.artist,
        })),
      );

      setPageMessage("Playlist order saved to Spotify and Playlist Manager.");
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : "Save order failed.",
      );
    }
  };

  const handleAddOneTrack = async () => {
    const parsed = await parseTrackInput(addTrackInput);

    if (!parsed) {
      if (extractSpotifyAlbumId(addTrackInput)) {
        setPageMessage(
          "This is a Spotify album or single link. Open the song, choose Share, then paste the Spotify track link so the song name, artist, and valid track ID can be added.",
        );
      } else {
        setPageMessage(
          "Paste a valid Spotify track link or type Song Name - Artist Name.",
        );
      }
      return;
    }

    if (addTrackMode === "current") {
      const targetMasterId = state.selectedSavedMasterPlaylistId;

      if (!targetMasterId) {
        setPageMessage("Select a master playlist first.");
        return;
      }

      const existingBox = state.masterCurationBoxes.find(
        (box) => box.masterPlaylistId === targetMasterId,
      );

      let nextBoxes: MasterCurationBox[];

      if (existingBox) {
        nextBoxes = state.masterCurationBoxes.map((box) =>
          box.id === existingBox.id
            ? {
                ...box,
                tracks: insertAtPosition(box.tracks, parsed, placementNumber),
              }
            : box,
        );
      } else {
        nextBoxes = [
          {
            id: makeId("curation-box"),
            masterPlaylistId: targetMasterId,
            curationName: "Manual Curation",
            createdAt: new Date().toISOString(),
            tracks: insertAtPosition([], parsed, placementNumber),
          },
          ...state.masterCurationBoxes,
        ];
      }

      persistState({ ...state, masterCurationBoxes: nextBoxes });
    } else {
      if (state.savedMasterPlaylists.length === 0) {
        setPageMessage("No saved master playlists available.");
        return;
      }

      const existingByMaster = new Map(
        state.masterCurationBoxes.map((box) => [box.masterPlaylistId, box]),
      );

      const nextBoxes = [...state.masterCurationBoxes];

      state.savedMasterPlaylists.forEach((master) => {
        const existing = existingByMaster.get(master.id);

        if (existing) {
          const updated = {
            ...existing,
            tracks: insertAtPosition(existing.tracks, parsed, placementNumber),
          };
          const index = nextBoxes.findIndex((box) => box.id === existing.id);
          if (index >= 0) nextBoxes[index] = updated;
        } else {
          nextBoxes.unshift({
            id: makeId("curation-box"),
            masterPlaylistId: master.id,
            curationName: "Manual Curation",
            createdAt: new Date().toISOString(),
            tracks: insertAtPosition([], parsed, placementNumber),
          });
        }
      });

      persistState({ ...state, masterCurationBoxes: nextBoxes });
    }

    setAddTrackInput("");
    setPlacementNumber("");
    setAddTrackOpen(false);
    setPageMessage(
      addTrackMode === "all"
        ? `Track inserted into all saved master playlists: ${parsed.title}${parsed.artist ? ` - ${parsed.artist}` : ""}.`
        : `Track inserted into current master playlist: ${parsed.title}${parsed.artist ? ` - ${parsed.artist}` : ""}.`,
    );
  };

  const handleSyncSinglePlaylist = async (
    playlistId: number,
    accountId: number,
    playlistName: string,
    localSyncedId?: string,
  ) => {
    if (!selectedCurationBox || selectedCurationBox.tracks.length === 0) {
      setPageMessage("No curation tracks available to sync.");
      return;
    }

    const confirmed = window.confirm(
      `Update "${playlistName}" on Spotify?\n\nThis will remove every current song and replace it with the curation shown in the Master Playlist box.`,
    );

    if (!confirmed) return;

    const progressKey = localSyncedId || "master";

    try {
      setSyncProgress((current) => ({ ...current, [progressKey]: 20 }));
      setSyncStatus((current) => ({ ...current, [progressKey]: "Syncing..." }));

      await replacePlaylistTracks(
        accountId,
        playlistId,
        selectedCurationBox.tracks.map((track) => ({
          id: track.spotify_id || track.id,
          spotify_id: track.spotify_id || track.id,
          title: track.title,
          artist: track.artist,
        })),
      );

      setSyncProgress((current) => ({ ...current, [progressKey]: 100 }));
      setSyncStatus((current) => ({ ...current, [progressKey]: "Done" }));

      const now = new Date().toISOString();

      if (localSyncedId) {
        persistState({
          ...state,
          syncedPlaylists: state.syncedPlaylists.map((playlist) =>
            playlist.id === localSyncedId
              ? { ...playlist, lastSyncedAt: now, checked: true }
              : playlist,
          ),
        });
      } else {
        persistState({
          ...state,
          masterPlaylistLastSyncedAt: now,
          masterPlaylistSyncHistory: [
            now,
            ...state.masterPlaylistSyncHistory.filter((item) => item !== now),
          ].slice(0, 3),
        });
      }

      setPageMessage(`${playlistName} updated on Spotify.`);
    } catch (error) {
      setSyncProgress((current) => ({ ...current, [progressKey]: 0 }));
      setSyncStatus((current) => ({ ...current, [progressKey]: "Failed" }));
      setPageMessage(error instanceof Error ? error.message : "Sync failed.");
    }
  };

  const handleSyncAllSelected = async () => {
    const selected = visibleSyncedPlaylists.filter(
      (playlist) => playlist.checked,
    );

    if (selected.length === 0) {
      setPageMessage("Select at least one synced playlist first.");
      return;
    }

    if (!selectedCurationBox || selectedCurationBox.tracks.length === 0) {
      setPageMessage("No curation tracks available to sync.");
      return;
    }

    const estimatedSeconds = Math.max(0, selected.length - 1) * (SAFE_SYNC_DELAY_MS / 1000);
    const confirmed = window.confirm(
      `Update ${selected.length} selected playlist(s)?\n\nEach selected playlist will be replaced with the curation shown in the Master Playlist box.\n\nSafe sync mode: 1 playlist every ${SAFE_SYNC_DELAY_MS / 1000} seconds. Estimated delay: ${estimatedSeconds} seconds.`,
    );

    if (!confirmed) return;

    let failed = false;
    const now = new Date().toISOString();
    const updatedSynced = [...state.syncedPlaylists];

    for (let index = 0; index < selected.length; index += 1) {
      const playlist = selected[index];

      try {
        if (index > 0) {
          setSyncStatus((current) => ({
            ...current,
            [playlist.id]: `Waiting ${SAFE_SYNC_DELAY_MS / 1000}s...`,
          }));
          setSyncProgress((current) => ({ ...current, [playlist.id]: 10 }));
          await wait(SAFE_SYNC_DELAY_MS);
        }

        setSyncProgress((current) => ({ ...current, [playlist.id]: 35 }));
        setSyncStatus((current) => ({ ...current, [playlist.id]: "Syncing..." }));

        await replacePlaylistTracks(
          playlist.accountId,
          playlist.playlistId,
          selectedCurationBox.tracks.map((track) => ({
            id: track.spotify_id || track.id,
            spotify_id: track.spotify_id || track.id,
            title: track.title,
            artist: track.artist,
          })),
        );

        setSyncProgress((current) => ({ ...current, [playlist.id]: 100 }));
        setSyncStatus((current) => ({ ...current, [playlist.id]: "Done" }));

        const updatedIndex = updatedSynced.findIndex(
          (item) => item.id === playlist.id,
        );
        if (updatedIndex >= 0) {
          updatedSynced[updatedIndex] = {
            ...updatedSynced[updatedIndex],
            lastSyncedAt: now,
            checked: true,
          };
        }
      } catch {
        failed = true;
        setSyncProgress((current) => ({ ...current, [playlist.id]: 0 }));
        setSyncStatus((current) => ({ ...current, [playlist.id]: "Failed" }));
      }
    }

    persistState({ ...state, syncedPlaylists: updatedSynced });
    setPageMessage(
      failed
        ? "Some selected playlists failed to sync. Safe sync mode stopped only for failed requests."
        : `${selected.length} selected playlist(s) synced safely at 1 playlist every ${SAFE_SYNC_DELAY_MS / 1000} seconds.`,
    );
  };

  const handleDeleteMaster = () => {
    if (!selectedMaster) return;

    const confirmed = window.confirm(
      `Delete "${selectedMaster.name}" from saved master playlists?\n\nThis only removes it from Playlist Manager. It will not delete it from Spotify.`,
    );

    if (!confirmed) return;

    const remaining = state.savedMasterPlaylists.filter(
      (playlist) => playlist.id !== selectedMaster.id,
    );
    const nextMaster = remaining[0] ?? null;

    persistState({
      ...state,
      savedMasterPlaylists: remaining,
      selectedSavedMasterPlaylistId: nextMaster?.id ?? null,
      ...syncMasterMetaFromSelection(nextMaster),
      masterCurationBoxes: state.masterCurationBoxes.filter(
        (box) => box.masterPlaylistId !== selectedMaster.id,
      ),
    });
  };

  const selectedCount = visibleSelectedCount;

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-black px-8 py-10 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <style jsx global>{`
        html,
        body {
          scrollbar-color: #22c55e #000000;
          scrollbar-width: thin;
          background: #000000;
        }

        *::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        *::-webkit-scrollbar-track {
          background: #000000;
        }

        *::-webkit-scrollbar-thumb {
          background: #22c55e;
          border-radius: 999px;
          border: 2px solid #000000;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: #16a34a;
        }

        .scrollbar-spotify {
          scrollbar-color: #22c55e #000000;
          scrollbar-width: thin;
        }

        .playlist-select {
          color-scheme: dark;
          scrollbar-color: #22c55e #000000;
        }

        .playlist-select option {
          background: #000000;
          color: #ffffff;
        }
      `}</style>
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Playlist Manager
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Manage one master playlist and synced playlists.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) =>
              handleImportCsvFile(event.target.files?.[0] ?? null)
            }
          />
          <button
            type="button"
            onClick={handleRefreshPlaylistNames}
            disabled={isRefreshingNames || accounts.length === 0}
            aria-label="Refresh Names"
            title="Refresh Names"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className={`h-5 w-5 ${isRefreshingNames ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleClearAllPlaylistManager}
            className="h-12 rounded-xl border border-red-500/40 bg-red-500/10 px-6 text-sm font-semibold text-red-300 hover:bg-red-500/20"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="h-12 rounded-xl bg-green-600 px-6 text-sm font-semibold text-white hover:bg-green-500"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadCsvTemplate}
            aria-label="Download CSV template"
            title="Download CSV template"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 text-lg font-semibold text-white hover:bg-zinc-900"
          >
            ↓
          </button>
        </div>
      </div>

      {pageMessage ? (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          {pageMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="min-h-[80vh] rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex gap-4">
            <select
              value={state.selectedSavedMasterPlaylistId ?? ""}
              onChange={(event) => handleSelectMaster(event.target.value)}
              className="playlist-select h-12 flex-1 rounded-xl border border-zinc-800 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-green-500"
            >
              <option value="">Master Playlist</option>
              {sortedSavedMasterPlaylists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setImportMode("master")}
              className="h-12 rounded-xl bg-green-600 px-7 text-sm font-semibold text-white hover:bg-green-500"
            >
              Import
            </button>

            <button
              type="button"
              onClick={handleSaveOrder}
              className="h-12 rounded-xl border border-zinc-700 px-7 text-sm font-semibold text-white hover:bg-zinc-900"
            >
              Save
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold text-white">
                  {state.masterPlaylistName || "No master playlist imported"}
                </h2>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-3">
                  {selectedMaster ? (
                    <button
                      type="button"
                      aria-label="Delete master playlist"
                      title="Delete master playlist"
                      onClick={handleDeleteMaster}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 text-lg font-bold text-red-300 hover:bg-red-500/20"
                    >
                      ×
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      !state.masterPlaylistId || !state.masterPlaylistAccountId
                    }
                    onClick={() =>
                      state.masterPlaylistId && state.masterPlaylistAccountId
                        ? handleSyncSinglePlaylist(
                            state.masterPlaylistId,
                            state.masterPlaylistAccountId,
                            state.masterPlaylistName || "Master Playlist",
                          )
                        : null
                    }
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    Sync
                  </button>
                </div>

                <div className="mt-4 text-xs uppercase tracking-wide text-zinc-500">
                  Sync Log
                </div>
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  {state.masterPlaylistSyncHistory.length === 0 ? (
                    <div>Never synced</div>
                  ) : (
                    state.masterPlaylistSyncHistory
                      .slice(0, 3)
                      .map((item, index) => (
                        <div key={`${item}-${index}`}>
                          {formatDateTime(item)}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {selectedMaster?.name ||
                      selectedCurationBox?.curationName ||
                      "Manual Curation"}
                  </h3>
                  <div className="mt-1 text-xs text-zinc-500">
                    {formatDateTime(selectedCurationBox?.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="text-xs text-zinc-400">
                    {selectedCurationBox?.tracks.length ?? 0} tracks
                  </span>

                  {selectedCurationBox && selectedCurationBox.tracks.length > 0 ? (
                    selectedTrackCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={handleDeselectCurationTracks}
                          className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
                        >
                          Deselect
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelectedCurationTracks}
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                          Delete Selected ({selectedTrackCount})
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleSelectAllCurationTracks}
                          className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCurationTracks}
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                          Clear
                        </button>
                      </>
                    )
                  ) : null}

                  {trackUndoStack.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleUndoCurationTrackDelete}
                      className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/20"
                    >
                      Undo
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setAddTrackOpen(true)}
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500"
                  >
                    Insert Track
                  </button>
                </div>
              </div>

              {!selectedCurationBox ||
              selectedCurationBox.tracks.length === 0 ? (
                <div className="flex h-[360px] items-center justify-center rounded-2xl border border-zinc-800 text-sm text-zinc-500">
                  No curation tracks yet.
                </div>
              ) : (
                <div className="scrollbar-spotify max-h-[520px] space-y-2 overflow-y-auto pr-2">
                  {selectedCurationBox.tracks.map((track, index) => {
                    const trackKey = makeCurationTrackKey(track, index);
                    const isSelected = selectedTrackKeys.has(trackKey);

                    return (
                      <div
                        key={trackKey}
                        draggable
                        onClick={(event) => handleToggleCurationTrack(index, event.shiftKey)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setTrackDragIndex(index);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDropTrack(index);
                        }}
                        className={`cursor-grab rounded-xl border px-4 py-3 transition active:cursor-grabbing ${
                          isSelected
                            ? "border-green-500 bg-green-500/10 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]"
                            : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => undefined}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleCurationTrack(index, event.shiftKey);
                              }}
                              className="h-4 w-4 accent-green-500"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {index + 1}. {track.title}
                              </div>
                              <div className="mt-1 truncate text-xs text-zinc-500">
                                {track.artist}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveTrack(index);
                            }}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="min-h-[80vh] rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Synced Playlists
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Imported playlists: {importedSyncedCount}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Safe sync rate: 1 playlist every {SAFE_SYNC_DELAY_MS / 1000}s
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected =
                      visibleSyncedPlaylists.length > 0 &&
                      selectedCount === visibleSyncedPlaylists.length;
                    const visibleIds = new Set(
                      visibleSyncedPlaylists.map((playlist) => playlist.id),
                    );
                    persistState({
                      ...state,
                      syncedPlaylists: state.syncedPlaylists.map((playlist) =>
                        visibleIds.has(playlist.id)
                          ? { ...playlist, checked: !allSelected }
                          : playlist,
                      ),
                    });
                  }}
                  className="text-white hover:text-green-400"
                >
                  {visibleSyncedPlaylists.length > 0 &&
                  selectedCount === visibleSyncedPlaylists.length
                    ? `Deselect All (${selectedCount})`
                    : `Select All${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
                </button>

                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      persistState({
                        ...state,
                        syncedPlaylists: state.syncedPlaylists.filter(
                          (playlist) =>
                            !visibleSyncedPlaylists.some(
                              (visible) => visible.id === playlist.id,
                            ) || !playlist.checked,
                        ),
                      })
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSyncAllSelected}
                className="h-12 rounded-xl border border-zinc-700 px-7 text-sm font-semibold text-white hover:bg-zinc-900"
              >
                Sync All
              </button>
              <button
                type="button"
                onClick={() => setImportMode("synced")}
                className="h-12 rounded-xl bg-green-600 px-7 text-sm font-semibold text-white hover:bg-green-500"
              >
                Import
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            {visibleSyncedPlaylists.length === 0 ? (
              <div className="flex h-[520px] items-center justify-center text-sm text-zinc-500">
                No synced playlists imported yet.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleSyncedPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <input
                        type="checkbox"
                        checked={playlist.checked}
                        className="h-4 w-4 accent-green-500"
                        onChange={(event) =>
                          persistState({
                            ...state,
                            syncedPlaylists: state.syncedPlaylists.map(
                              (item) =>
                                item.id === playlist.id
                                  ? { ...item, checked: event.target.checked }
                                  : item,
                            ),
                          })
                        }
                      />

                      <a
                        href={getSyncedPlaylistSpotifyUrl(playlist, allPlaylists) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          if (!getSyncedPlaylistSpotifyUrl(playlist, allPlaylists)) {
                            event.preventDefault();
                          }
                        }}
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-800 transition hover:ring-2 hover:ring-green-500"
                        title="Open playlist on Spotify"
                      >
                        {playlist.imageUrl ? (
                          <img
                            src={playlist.imageUrl}
                            alt={playlist.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </a>

                      <div className="min-w-0">
                        <a
                          href={getSyncedPlaylistSpotifyUrl(playlist, allPlaylists) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => {
                            if (!getSyncedPlaylistSpotifyUrl(playlist, allPlaylists)) {
                              event.preventDefault();
                            }
                          }}
                          className="block truncate text-sm font-semibold text-white transition hover:text-green-400"
                          title="Open playlist on Spotify"
                        >
                          {playlist.name}
                        </a>
                        <div className="mt-1 text-xs text-zinc-500">
                          Last synced: {formatDateTime(playlist.lastSyncedAt)}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${syncProgress[playlist.id] ?? 0}%` }}
                          />
                        </div>
                        {syncStatus[playlist.id] ? (
                          <div className="mt-1 text-xs text-green-400">
                            {syncStatus[playlist.id]}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleSyncSinglePlaylist(
                            playlist.playlistId,
                            playlist.accountId,
                            playlist.name,
                            playlist.id,
                          )
                        }
                        className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500"
                      >
                        Sync
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          persistState({
                            ...state,
                            syncedPlaylists: state.syncedPlaylists.filter(
                              (item) => item.id !== playlist.id,
                            ),
                          })
                        }
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {importMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-white">
              Import{" "}
              {importMode === "master" ? "Master Playlist" : "Synced Playlist"}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Paste Spotify link. The playlist must already be synced in one of
              your connected accounts.
            </p>

            <input
              value={importPlaylistLink}
              onChange={(event) => setImportPlaylistLink(event.target.value)}
              placeholder="Paste Spotify link"
              className="mt-5 h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none focus:border-green-500"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setImportMode(null);
                  setImportPlaylistLink("");
                }}
                className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImportPlaylist}
                className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addTrackOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-white">Insert Track</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Paste a Spotify track link or type Song Name - Artist Name. Add a
              placement number to insert the track exactly where you want it.
            </p>

            <input
              value={addTrackInput}
              onChange={(event) => setAddTrackInput(event.target.value)}
              placeholder="Paste Spotify link or Song Name - Artist Name"
              className="mt-5 h-12 w-full rounded-xl border border-green-500 bg-black px-4 text-sm text-white outline-none"
            />

            <input
              value={placementNumber}
              onChange={(event) => setPlacementNumber(event.target.value)}
              type="text"
              inputMode="numeric"
              placeholder="Placement number (optional)"
              className="mt-3 h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none focus:border-green-500"
            />

            <div className="mt-5 rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="mb-3 text-sm font-semibold text-white">
                Apply to
              </div>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="radio"
                  checked={addTrackMode === "current"}
                  onChange={() => setAddTrackMode("current")}
                />
                Current playlist only
              </label>
              <label className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="radio"
                  checked={addTrackMode === "all"}
                  onChange={() => setAddTrackMode("all")}
                />
                All saved playlists
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAddTrackOpen(false)}
                className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddOneTrack}
                className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500"
              >
                Insert Track
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
