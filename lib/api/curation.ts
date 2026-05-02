import { API_BASE } from "./client";

export type CurationTrack = {
  id: string;
  title: string;
  artist: string;
  spotify_id?: string | null;
};

export type ImportedLinkItem = {
  link: string;
  source_type: string;
  display_name: string;
  track_count: number;
  tracks: CurationTrack[];
};

type AccountItem = {
  id: number;
  display_name?: string;
};

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

function normalizeTrack(row: any, index: number): CurationTrack {
  const track = row?.track || row;

  const title =
    track?.title ||
    track?.name ||
    track?.track_name ||
    "Untitled Track";

  const artist =
    track?.artist ||
    track?.artist_name ||
    track?.artists?.[0]?.name ||
    (Array.isArray(track?.artists)
      ? track.artists.map((item: any) => item?.name).filter(Boolean).join(", ")
      : "") ||
    "Unknown Artist";

  return {
    id: String(track?.id || track?.spotify_id || `track-${index}`),
    title: String(title),
    artist: String(artist),
  };
}

function normalizeImportedPayload(payload: any, link: string): ImportedLinkItem {
  const root = payload ?? {};

  const tracksRaw = Array.isArray(root.tracks)
    ? root.tracks
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.data)
        ? root.data
        : [];

  const tracks = tracksRaw.map((track: any, index: number) =>
    normalizeTrack(track, index),
  );

  return {
    link,
    source_type: String(root.source_type || root.type || "playlist"),
    display_name: String(
      root.display_name ||
        root.name ||
        root.playlist_name ||
        "Imported Playlist",
    ),
    track_count: Number(root.track_count || tracks.length || 0),
    tracks,
  };
}

async function requestWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000,
): Promise<T> {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null
          ? data.detail || data.message || `Request failed with status ${response.status}`
          : data || `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Import timed out. Check FastAPI and Spotify token.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveAccountId(accountId?: number | null): Promise<number> {
  if (accountId && Number.isFinite(accountId)) {
    return accountId;
  }

  const accountsPayload = await requestWithTimeout<
    AccountItem[] | { items?: AccountItem[] }
  >(`${API_ROOT}/api/accounts`, {
    method: "GET",
  });

  const accounts = Array.isArray(accountsPayload)
    ? accountsPayload
    : Array.isArray(accountsPayload.items)
      ? accountsPayload.items
      : [];

  const firstAccount = accounts[0];

  if (!firstAccount?.id) {
    throw new Error("No Spotify account found. Connect or select an account first.");
  }

  return firstAccount.id;
}

/**
 * Supports both:
 * importSpotifyLink(link)
 * importSpotifyLink(accountId, link)
 */
export async function importSpotifyLink(
  accountIdOrLink: number | string | null | undefined,
  maybeLink?: string | null,
): Promise<ImportedLinkItem> {
  const accountId =
    typeof accountIdOrLink === "number" ? accountIdOrLink : null;

  const rawLink =
    typeof accountIdOrLink === "string" ? accountIdOrLink : maybeLink;

  if (!rawLink || typeof rawLink !== "string") {
    throw new Error("No Spotify link provided.");
  }

  const cleanLink = rawLink.trim();

  if (!cleanLink) {
    throw new Error("Paste a Spotify playlist or album link first.");
  }

  const resolvedAccountId = await resolveAccountId(accountId);

  const payload = await requestWithTimeout<any>(
    `${API_ROOT}/api/accounts/${resolvedAccountId}/curation/import`,
    {
      method: "POST",
      body: JSON.stringify({
        link: cleanLink,
      }),
    },
    30000,
  );

  return normalizeImportedPayload(payload, cleanLink);
}