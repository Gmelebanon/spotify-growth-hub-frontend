"use client";

import { useEffect, useMemo, useState } from "react";
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
  account_id?: number;
};

type FlatPlaylistItem = PlaylistItem & {
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
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function normalizeState(raw: Partial<PlaylistManagerState>): PlaylistManagerState {
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
    syncedPlaylists: Array.isArray(raw.syncedPlaylists) ? raw.syncedPlaylists : [],
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
  const trimmed = input.trim();
  const directMatch = trimmed.match(/playlist\/([a-zA-Z0-9]+)(\?|$|\/)/);
  if (directMatch?.[1]) return directMatch[1];

  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  return null;
}

function findPlaylistByLink(playlists: FlatPlaylistItem[], value: string) {
  const clean = value.trim();
  const spotifyPlaylistId = extractSpotifyPlaylistId(clean);

  return playlists.find((playlist) => {
    const spotifyUrl = playlist.spotify_url || "";
    return (
      (spotifyPlaylistId ? spotifyUrl.includes(spotifyPlaylistId) : false) ||
      String(playlist.id) === clean ||
      playlist.name.toLowerCase() === clean.toLowerCase()
    );
  });
}

async function parseTrackInput(value: string): Promise<AddedTrack | null> {
  const clean = value.trim();
  if (!clean) return null;

  const spotifyTrackId = extractSpotifyTrackId(clean);

  if (spotifyTrackId) {
    try {
      const response = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(
          `https://open.spotify.com/track/${spotifyTrackId}`,
        )}`,
      );

      if (!response.ok) throw new Error("Spotify lookup failed");

      const data = await response.json();

      return {
        id: spotifyTrackId,
        spotify_id: spotifyTrackId,
        title: String(data.title || "Spotify Track"),
        artist: String(data.author_name || "Unknown Artist"),
        createdAt: new Date().toISOString(),
      };
    } catch {
      return {
        id: spotifyTrackId,
        spotify_id: spotifyTrackId,
        title: "Spotify Track",
        artist: spotifyTrackId,
        createdAt: new Date().toISOString(),
      };
    }
  }

  const parts = clean.split(" - ").map((item) => item.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      id: makeId("manual-track"),
      spotify_id: null,
      title: parts[0],
      artist: parts.slice(1).join(" - "),
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

function normalizeDraftTrack(track: NonNullable<CurationDraft["tracks"]>[number]): AddedTrack {
  const spotifyId = track.spotify_id || track.id || makeId("draft-track");
  return {
    id: spotifyId,
    spotify_id: track.spotify_id || track.id || null,
    title: track.title || track.name || "Untitled Track",
    artist: track.artist || track.artist_name || "Unknown Artist",
    createdAt: new Date().toISOString(),
  };
}

function insertAtPosition(tracks: AddedTrack[], track: AddedTrack, placement: string) {
  const next = [...tracks];
  const parsed = Number(placement);

  if (!placement.trim() || !Number.isFinite(parsed) || parsed <= 0) {
    next.push(track);
    return next;
  }

  const index = Math.min(Math.max(parsed - 1, 0), next.length);
  next.splice(index, 0, track);
  return next;
}

function reorderTracks(tracks: AddedTrack[], fromIndex: number, toIndex: number) {
  const next = [...tracks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
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
        .filter((box) => box.masterPlaylistId === state.selectedSavedMasterPlaylistId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] ?? null
    );
  }, [state.masterCurationBoxes, state.selectedSavedMasterPlaylistId]);

  useEffect(() => {
    if (!hydrated) return;

    const interval = window.setInterval(() => {
      const raw = window.localStorage.getItem(CURATION_DRAFT_KEY);
      if (!raw) return;

      try {
        const draft = JSON.parse(raw) as CurationDraft;
        const targetMasterId = draft.target_master_playlist_id;
        const tracks = (draft.tracks ?? []).map(normalizeDraftTrack);

        if (!targetMasterId || tracks.length === 0) return;

        setState((current) => {
          const existingSameDraft = current.masterCurationBoxes.some(
            (box) =>
              box.masterPlaylistId === targetMasterId &&
              box.createdAt === (draft.created_at || ""),
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

  const syncMasterMetaFromSelection = (master: SavedMasterPlaylistOption | null) => {
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
    const master = state.savedMasterPlaylists.find((item) => item.id === id) ?? null;
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
      setPageMessage("Playlist was not found in synced accounts. Sync accounts first, then paste the Spotify playlist link again.");
      return;
    }

    if (importMode === "master") {
      const existing = state.savedMasterPlaylists.find(
        (item) => item.playlistId === selected.id && item.accountId === selected.accountId,
      );

      const master: SavedMasterPlaylistOption =
        existing ??
        {
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
      const exists = state.syncedPlaylists.some(
        (item) => item.playlistId === selected.id && item.accountId === selected.accountId,
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

    const tracks = selectedCurationBox.tracks.filter((_, index) => index !== trackIndex);
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
        setPageMessage("Playlist Manager saved. This master playlist has 0 curation tracks.");
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
      setPageMessage(error instanceof Error ? error.message : "Save order failed.");
    }
  };

  const handleAddOneTrack = async () => {
    const parsed = await parseTrackInput(addTrackInput);

    if (!parsed) {
      setPageMessage("Paste a Spotify track link or type Song Name - Artist Name.");
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
    const selected = state.syncedPlaylists.filter((playlist) => playlist.checked);

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

        const index = updatedSynced.findIndex((item) => item.id === playlist.id);
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
      failed ? "Some selected playlists failed to sync." : "Selected playlists synced.",
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

  const selectedCount = state.syncedPlaylists.filter((playlist) => playlist.checked).length;

  if (!hydrated) {
    return <div className="min-h-screen bg-black px-8 py-10 text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Playlist Manager</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage one master playlist and synced playlists.
        </p>
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
                    disabled={!state.masterPlaylistId || !state.masterPlaylistAccountId}
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
                    state.masterPlaylistSyncHistory.slice(0, 3).map((item, index) => (
                      <div key={`${item}-${index}`}>{formatDateTime(item)}</div>
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
                    disabled={!selectedCurationBox || selectedCurationBox.tracks.length === 0}
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

              {!selectedCurationBox || selectedCurationBox.tracks.length === 0 ? (
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
              <h2 className="text-2xl font-semibold text-white">Synced Playlists</h2>
              <div className="mt-4 flex items-center gap-4 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = state.syncedPlaylists.length > 0 && selectedCount === state.syncedPlaylists.length;
                    persistState({
                      ...state,
                      syncedPlaylists: state.syncedPlaylists.map((playlist) => ({
                        ...playlist,
                        checked: !allSelected,
                      })),
                    });
                  }}
                  className="text-white hover:text-green-400"
                >
                  {state.syncedPlaylists.length > 0 && selectedCount === state.syncedPlaylists.length ? "Deselect All" : "Select All"}
                </button>

                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      persistState({
                        ...state,
                        syncedPlaylists: state.syncedPlaylists.filter(
                          (playlist) => !playlist.checked,
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
            {state.syncedPlaylists.length === 0 ? (
              <div className="flex h-[520px] items-center justify-center text-sm text-zinc-500">
                No synced playlists imported yet.
              </div>
            ) : (
              <div className="space-y-4">
                {state.syncedPlaylists.map((playlist) => (
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
                            syncedPlaylists: state.syncedPlaylists.map((item) =>
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
              Import {importMode === "master" ? "Master Playlist" : "Synced Playlist"}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Paste Spotify link. The playlist must already be synced in one of your connected accounts.
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
              Paste a Spotify track link or type Song Name - Artist Name. Add a placement number to insert the track exactly where you want it.
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
              <div className="mb-3 text-sm font-semibold text-white">Apply to</div>
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
