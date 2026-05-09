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
      ? raw.syncedPlaylists
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




async function parseTrackInput(input: string) {
  const clean = input.trim();

  if (!clean) return null;

  const spotifyTrackMatch =
    clean.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/) ||
    clean.match(/spotify:track:([A-Za-z0-9]+)/);

  const spotifyId = spotifyTrackMatch?.[1];

  return {
    id: spotifyId || `typed-${Date.now()}`,
    spotify_id: spotifyId,
    title: clean,
    name: clean,
    artist: "",
    artist_name: "",
    album_name: "",
    image_url: null,
    spotify_url: spotifyId ? `https://open.spotify.com/track/${spotifyId}` : null,
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
        extractSpotifyPlaylistId(playlist.external_url || ""),
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

          const nextBox: MasterCurationBox = {
            id: makeId("curation-box"),
            masterPlaylistId: targetMasterId,
            curationName: draft.curation_name || "Curation Draft",
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
              checked: false,
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
    const template = [
      [
        "account_name",
        "master_playlist_id",
        "master_playlist_name",
        "synced_playlist_1",
        "synced_playlist_2",
        "synced_playlist_3",
        "synced_playlist_4",
        "synced_playlist_5",
      ]
        .map(escapeCsvValue)
        .join(","),
      [
        "Kim Kay",
        "0rgFb1H731kfBzlc26zqsW",
        "Techno Main",
        "14bqGG3a6QuKmKGpWyfjVq",
        "14kFZUwk9tFNmBjQ8deYa8",
        "7zZnRHmr84TYObDkTkcxEn",
        "",
        "",
      ]
        .map(escapeCsvValue)
        .join(","),
    ].join("\n");
    downloadTextFile("playlist_manager_template.csv", template);
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
            checked: false,
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

  const handleRemoveTrack = (trackIndex: number) => {
    if (!selectedCurationBox) return;

    const tracks = selectedCurationBox.tracks.filter(
      (_, index) => index !== trackIndex,
    );
    updateSelectedCurationTracks(tracks);
  };

  const handleClearCurationTracks = () => {
    if (!selectedCurationBox || selectedCurationBox.tracks.length === 0) return;

    const confirmed = window.confirm(
      `Clear all songs from "${selectedCurationBox.curationName || "Manual Curation"}"?\n\nThis only clears the Playlist Manager curation list. It will not delete songs from Spotify until you sync/save to Spotify.`,
    );

    if (!confirmed) return;

    updateSelectedCurationTracks([]);
    setPageMessage("Curation tracks cleared. Click Save to store this change.");
  };

  const handleDropTrack = (targetIndex: number) => {
    if (!selectedCurationBox || trackDragIndex === null) return;
    if (trackDragIndex === targetIndex) {
      setTrackDragIndex(null);
      return;
    }

    updateSelectedCurationTracks(
      reorderTracks(selectedCurationBox.tracks, trackDragIndex, targetIndex),
    );
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
      setPageMessage(
        "Paste a Spotify track link or type Song Name - Artist Name.",
      );
      return;
    }

    if (addTrackMode === "current") {
      if (!selectedCurationBox) {
        setPageMessage("No curation box selected for this master playlist.");
        return;
      }

      updateSelectedCurationTracks(
        insertAtPosition(selectedCurationBox.tracks, parsed, placementNumber),
      );
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
        ? "Track inserted into all saved master playlists."
        : "Track inserted into current master playlist.",
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

    try {
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

      const now = new Date().toISOString();

      if (localSyncedId) {
        persistState({
          ...state,
          syncedPlaylists: state.syncedPlaylists.map((playlist) =>
            playlist.id === localSyncedId
              ? { ...playlist, lastSyncedAt: now, checked: false }
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

    const confirmed = window.confirm(
      `Update ${selected.length} selected playlist(s)?\n\nEach selected playlist will be replaced with the curation shown in the Master Playlist box.`,
    );

    if (!confirmed) return;

    let failed = false;
    const now = new Date().toISOString();
    const updatedSynced = [...state.syncedPlaylists];

    for (const playlist of selected) {
      try {
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

        const index = updatedSynced.findIndex(
          (item) => item.id === playlist.id,
        );
        if (index >= 0) {
          updatedSynced[index] = {
            ...updatedSynced[index],
            lastSyncedAt: now,
            checked: false,
          };
        }
      } catch {
        failed = true;
      }
    }

    persistState({ ...state, syncedPlaylists: updatedSynced });
    setPageMessage(
      failed
        ? "Some selected playlists failed to sync."
        : "Selected playlists synced.",
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
              className="h-12 flex-1 rounded-xl border border-zinc-800 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-green-500"
            >
              <option value="">Master Playlist</option>
              {state.savedMasterPlaylists.map((playlist) => (
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
              <div className="flex gap-5">
                <div className="h-[150px] w-[150px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  {state.masterPlaylistImageUrl ? (
                    <img
                      src={state.masterPlaylistImageUrl}
                      alt={state.masterPlaylistName}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    {state.masterPlaylistName || "No master playlist imported"}
                  </h2>
                </div>
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
                    {selectedCurationBox?.curationName || "Manual Curation"}
                  </h3>
                  <div className="mt-1 text-xs text-zinc-500">
                    {formatDateTime(selectedCurationBox?.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    {selectedCurationBox?.tracks.length ?? 0} tracks
                  </span>
                  <button
                    type="button"
                    disabled={
                      !selectedCurationBox ||
                      selectedCurationBox.tracks.length === 0
                    }
                    onClick={handleClearCurationTracks}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear
                  </button>
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
                  {selectedCurationBox.tracks.map((track, index) => (
                    <div
                      key={`${track.id}-${index}`}
                      draggable
                      onDragStart={() => setTrackDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDropTrack(index)}
                      className="cursor-grab rounded-xl border border-green-500/40 bg-zinc-950 px-4 py-3 active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {index + 1}. {track.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-zinc-500">
                            {track.artist}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTrack(index)}
                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
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
                    ? "Deselect All"
                    : "Select All"}
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

                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-zinc-800">
                        {playlist.imageUrl ? (
                          <img
                            src={playlist.imageUrl}
                            alt={playlist.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {playlist.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Last synced: {formatDateTime(playlist.lastSyncedAt)}
                        </div>
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
