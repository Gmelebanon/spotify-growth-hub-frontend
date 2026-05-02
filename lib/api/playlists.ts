import { apiRequest } from "./client";

export type Playlist = {
  id: number;
  account_id: number;
  spotify_id: string | null;
  spotify_playlist_id?: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  owner_name: string | null;
  owner_display_name?: string | null;
  followers: number;
  growth?: number;
  growth_24h?: number;
  growth_7d?: number;
  growth_30d?: number;
  tracks_count: number;
  tracks_total?: number;
  total_tracks?: number;
  spotify_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlaylistHistoryItem = {
  id: number;
  playlist_id: number;
  followers: number;
  date: string | null;
  created_at: string | null;
};

export type PlaylistTrack = {
  id: string;
  spotify_id: string | null;
  name: string;
  artist_name: string | null;
  album_name: string | null;
  image_url: string | null;
  spotify_url: string | null;
};

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizePlaylist(row: Record<string, unknown>): Playlist {
  const spotifyId =
    typeof row.spotify_id === "string"
      ? row.spotify_id
      : typeof row.spotify_playlist_id === "string"
        ? row.spotify_playlist_id
        : null;

  const spotifyUrl =
    typeof row.spotify_url === "string"
      ? row.spotify_url
      : spotifyId
        ? `https://open.spotify.com/playlist/${spotifyId}`
        : null;

  const tracksCountCandidates = [
    row.tracks_count,
    row.tracks_total,
    row.total_tracks,
    row.track_count,
  ].map(normalizeNumber);

  const resolvedTracksCount =
    tracksCountCandidates.find((value) => Number.isFinite(value) && value > 0) ?? 0;

  return {
    id: normalizeNumber(row.id),
    account_id: normalizeNumber(row.account_id),
    spotify_id: spotifyId,
    spotify_playlist_id: spotifyId,
    name: typeof row.name === "string" ? row.name : "Untitled Playlist",
    description: typeof row.description === "string" ? row.description : null,
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    owner_name:
      typeof row.owner_name === "string"
        ? row.owner_name
        : typeof row.owner_display_name === "string"
          ? row.owner_display_name
          : null,
    owner_display_name:
      typeof row.owner_display_name === "string" ? row.owner_display_name : null,
    followers: normalizeNumber(row.followers),
    growth: normalizeNumber(row.growth),
    growth_24h: normalizeNumber(row.growth_24h),
    growth_7d: normalizeNumber(row.growth_7d),
    growth_30d: normalizeNumber(row.growth_30d),
    tracks_count: resolvedTracksCount,
    tracks_total: normalizeNumber(row.tracks_total),
    total_tracks: normalizeNumber(row.total_tracks),
    spotify_url: spotifyUrl,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function normalizePlaylists(payload: unknown): Playlist[] {
  const root = (payload ?? {}) as Record<string, unknown>;

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.playlists)
        ? root.playlists
        : Array.isArray(root.data)
          ? root.data
          : [];

  return items.map((item) =>
    normalizePlaylist((item ?? {}) as Record<string, unknown>),
  );
}

function normalizeHistory(payload: unknown): PlaylistHistoryItem[] {
  const root = (payload ?? {}) as Record<string, unknown>;

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.history)
        ? root.history
        : [];

  return items.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;

    return {
      id: normalizeNumber(row.id),
      playlist_id: normalizeNumber(row.playlist_id),
      followers: normalizeNumber(row.followers),
      date:
        typeof row.date === "string"
          ? row.date
          : typeof row.created_at === "string"
            ? row.created_at
            : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
    };
  });
}

function normalizeTracks(payload: unknown): PlaylistTrack[] {
  const root = (payload ?? {}) as Record<string, unknown>;

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.tracks)
        ? root.tracks
        : Array.isArray(root.data)
          ? root.data
          : [];

  return items.map((item, index) => {
    const row = (item ?? {}) as Record<string, unknown>;

    const spotifyId =
      typeof row.spotify_id === "string"
        ? row.spotify_id
        : typeof row.track_id === "string"
          ? row.track_id
          : typeof row.id === "string"
            ? row.id
            : null;

    const artistName =
      typeof row.artist_name === "string"
        ? row.artist_name
        : typeof row.artist === "string"
          ? row.artist
          : Array.isArray(row.artists) && row.artists.length > 0
            ? String(row.artists[0])
            : null;

    const spotifyUrl =
      typeof row.spotify_url === "string"
        ? row.spotify_url
        : spotifyId
          ? `https://open.spotify.com/track/${spotifyId}`
          : null;

    return {
      id: typeof row.id === "string" ? row.id : `${spotifyId ?? "track"}-${index}`,
      spotify_id: spotifyId,
      name: typeof row.name === "string" ? row.name : "Untitled Track",
      artist_name: artistName,
      album_name:
        typeof row.album_name === "string"
          ? row.album_name
          : typeof row.album === "string"
            ? row.album
            : null,
      image_url: typeof row.image_url === "string" ? row.image_url : null,
      spotify_url: spotifyUrl,
    };
  });
}

export async function getPlaylists(accountId: number): Promise<Playlist[]> {
  const payload = await apiRequest<unknown>(`/api/accounts/${accountId}/playlists`);
  return normalizePlaylists(payload);
}

export async function getDbPlaylists(accountId: number): Promise<Playlist[]> {
  return getPlaylists(accountId);
}

export async function getPlaylist(
  accountId: number,
  playlistId: number,
): Promise<Playlist> {
  const payload = await apiRequest<Record<string, unknown>>(
    `/api/accounts/${accountId}/playlists/${playlistId}`,
  );
  return normalizePlaylist(payload);
}

export async function getDbPlaylist(
  accountId: number,
  playlistId: number,
): Promise<Playlist> {
  return getPlaylist(accountId, playlistId);
}

export async function getPlaylistHistory(
  accountId: number,
  playlistId: number,
): Promise<PlaylistHistoryItem[]> {
  const payload = await apiRequest<unknown>(
    `/api/accounts/${accountId}/playlists/${playlistId}/history`,
  );
  return normalizeHistory(payload);
}

export async function getPlaylistTracks(
  accountId: number,
  playlistId: number,
): Promise<PlaylistTrack[]> {
  const payload = await apiRequest<unknown>(
    `/api/accounts/${accountId}/playlists/${playlistId}/tracks`,
  );
  return normalizeTracks(payload);
}

export async function syncPlaylist(accountId: number, playlistId: number) {
  return apiRequest(`/api/accounts/${accountId}/playlists/${playlistId}/sync`, {
    method: "POST",
  });
}

export async function syncAllPlaylistData(accountId: number, playlistId: number) {
  return syncPlaylist(accountId, playlistId);
}

export async function syncAllPlaylistsForAccount(
  accountId: number,
  limit = 25,
  offset = 0,
) {
  return apiRequest(
    `/api/accounts/${accountId}/playlists/sync?limit=${limit}&offset=${offset}`,
    {
      method: "POST",
    },
  );
}

export async function replacePlaylistTracks(
  accountId: number,
  playlistId: number,
  tracks: Array<{
    id?: string;
    spotify_id?: string | null;
    title?: string;
    name?: string;
    artist?: string;
    artist_name?: string | null;
  }>
) {
  return apiRequest(`/api/accounts/${accountId}/playlists/${playlistId}/replace-tracks`, {
    method: "POST",
    body: JSON.stringify({ tracks }),
  });
}