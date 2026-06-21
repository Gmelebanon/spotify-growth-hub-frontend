"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const ADDED_ARTISTS_STORAGE_KEY = "spotify-growth-hub-added-artists";
const REMOVED_ARTISTS_STORAGE_KEY = "spotify-growth-hub-removed-artists";

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function SpotifyIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 1.8C6.37 1.8 1.8 6.37 1.8 12S6.37 22.2 12 22.2 22.2 17.63 22.2 12 17.63 1.8 12 1.8Zm4.68 14.7a.77.77 0 0 1-1.06.25c-2.9-1.78-6.56-2.18-10.86-1.19a.77.77 0 1 1-.34-1.5c4.71-1.08 8.75-.62 12.01 1.38.36.22.48.7.25 1.06Zm1.25-2.78a.96.96 0 0 1-1.32.32c-3.32-2.04-8.39-2.63-12.32-1.44a.96.96 0 1 1-.56-1.84c4.49-1.36 10.07-.7 13.88 1.64.45.28.59.87.32 1.32Zm.11-2.9C14.06 8.46 7.5 8.25 3.7 9.47a1.15 1.15 0 0 1-.7-2.2c4.36-1.4 11.61-1.15 16.21 1.58a1.15 1.15 0 1 1-1.17 1.97Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </svg>
  );
}



function SortArrow({ active, direction }) {
  if (!active) return <span className="ml-1 text-black/60">↕</span>;

  return (
    <span className="ml-1 text-black">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

function formatDaysAgo(daysAgo) {
  if (typeof daysAgo !== "number") return "Recently";
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "1 day ago";
  return `${daysAgo} days ago`;
}

function formatManualUpdateAge(value) {
  if (!value) return "Last Updated on —";

  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return "Last Updated on uploaded date";
  }

  const dateText = updatedAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const now = new Date();
  const diffMs = now.getTime() - updatedAt.getTime();
  const days = Math.max(0, Math.floor(diffMs / 86400000));
  const ageText = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;

  return `Last Updated on ${dateText} - ${ageText}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatGrowth(value) {
  const number = Number(value || 0);

  if (number > 0) return `▲ ${formatNumber(number)}%`;
  if (number < 0) return `▼ ${formatNumber(Math.abs(number))}%`;

  return "0%";
}

function formatDelta(value) {
  const number = Number(value || 0);

  if (number > 0) return `+${formatNumber(number)}`;
  if (number < 0) return `-${formatNumber(Math.abs(number))}`;

  return "0";
}

function formatOptionalNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString();
}

function formatOptionalPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function formatCardPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0%";

  return `${number.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDateKey(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toISOString().slice(0, 10);
}

function getTodayDateKey() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function getHistoryDate(historyRow) {
  return normalizeDateKey(
    historyRow?.date ||
      historyRow?.created_at ||
      historyRow?.createdAt ||
      historyRow?.snapshot_date ||
      historyRow?.snapshotDate
  );
}

function getHistoryFollowers(historyRow) {
  return toNumber(
    historyRow?.followers ??
      historyRow?.follower_count ??
      historyRow?.followerCount ??
      historyRow?.count ??
      historyRow?.value,
    null
  );
}

function calculateFollowers7DaysFromHistory(artist) {
  const history =
    artist.followerHistory ||
    artist.followersHistory ||
    artist.followers_history ||
    artist.follower_history ||
    artist.history ||
    artist.snapshots ||
    artist.followerSnapshots ||
    artist.follower_snapshots ||
    [];

  if (!Array.isArray(history) || history.length === 0) return null;

  const currentFollowers = toNumber(artist.followers, null);
  if (currentFollowers === null) return null;

  const todayKey = getTodayDateKey();
  const sevenDaysAgo = getDateDaysAgo(7);

  const snapshots = history
    .map((row) => {
      const dateKey = getHistoryDate(row);
      const followers = getHistoryFollowers(row);

      if (!dateKey || followers === null) return null;

      const dateValue = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(dateValue.getTime())) return null;

      return { dateKey, dateValue, followers };
    })
    .filter(Boolean)
    .sort((a, b) => a.dateValue.getTime() - b.dateValue.getTime());

  if (snapshots.length === 0) return null;

  const previousSnapshots = snapshots.filter((snapshot) => {
    return snapshot.dateKey < todayKey;
  });

  if (previousSnapshots.length === 0) return null;

  const sevenDayWindowSnapshots = previousSnapshots.filter((snapshot) => {
    return snapshot.dateValue >= sevenDaysAgo;
  });

  const baselineSnapshot =
    sevenDayWindowSnapshots[0] || previousSnapshots[previousSnapshots.length - 1];

  return currentFollowers - baselineSnapshot.followers;
}

function getFollowers7DaysValue(artist) {
  const calculatedFromHistory = calculateFollowers7DaysFromHistory(artist);

  if (calculatedFromHistory !== null) {
    return calculatedFromHistory;
  }

  return toNumber(
    artist.followers7Days ??
      artist.followers_7_days ??
      artist.followers7days ??
      artist.followers_7d ??
      artist.growth7Days ??
      artist.growth_7_days ??
      artist.growth7d ??
      artist.growth_7d ??
      artist.sevenDays ??
      artist.seven_days,
    0
  );
}

function normalizeArtist(artist) {
  const artistId = artist.id || artist.artistId;
  const streams = toNumber(artist.streams ?? artist.totalStreams ?? artist.total_streams, 0);
  const totalTracks = toNumber(artist.totalTracks ?? artist.tracks ?? artist.total_tracks, 0);
  const explicitStreamsPerTrack = toNumber(
    artist.streamsPerTrack ??
      artist.streams_per_track ??
      artist.averageStreamsPerTrack ??
      artist.average_streams_per_track,
    null
  );
  const streamsPerTrack =
    explicitStreamsPerTrack !== null
      ? explicitStreamsPerTrack
      : totalTracks > 0
      ? Math.round(streams / totalTracks)
      : null;
  const radioDiscover = toNumber(
    artist.radioDiscover ??
      artist.radio_discover ??
      artist.radioAndDiscover ??
      artist.radio_and_discover ??
      artist.radioDiscoverStreams ??
      artist.radio_discover_streams ??
      artist.discoverStreams ??
      artist.discover_streams ??
      artist.radio ??
      artist.radioStreams ??
      artist.radio_streams,
    null
  );

  return {
    id: artistId,
    name: artist.name || "Spotify Artist",
    image: artist.image || artist.imageUrl || null,
    followers: artist.followers || 0,
    followers7Days: getFollowers7DaysValue(artist),
    popularity: artist.popularity || 0,
    genres: artist.genres || [],
    spotifyUrl:
      artist.spotifyUrl ||
      artist.spotify_url ||
      artist.external_urls?.spotify ||
      `https://open.spotify.com/artist/${artistId}`,
    streams,
    streamsPerTrack,
    streamsPercent:
      streams > 0 && streamsPerTrack !== null
        ? (streamsPerTrack / streams) * 100
        : null,
    radioDiscover,
    radioPercent:
      streams > 0 && radioDiscover !== null
        ? (radioDiscover / streams) * 100
        : null,
    manualGenre:
      artist.manualGenre ||
      artist.manual_genre ||
      artist.genre ||
      null,
    manualDataUpdatedAt:
      artist.manualDataUpdatedAt ||
      artist.manual_data_updated_at ||
      artist.manualUpdatedAt ||
      artist.manual_updated_at ||
      null,
    growthPercent: artist.growthPercent || artist.growth_percent || 0,
    totalReleases: artist.totalReleases || artist.releases || 0,
    totalTracks,
    latestRelease: artist.latestRelease || null,
    recentReleases:
      artist.recentReleases || artist.recent_releases || artist.releases || [],
    isManuallyAdded: Boolean(artist.isManuallyAdded),
  };
}

function getReleaseDaysAgo(releaseDate) {
  if (!releaseDate) return null;

  const releaseTime = new Date(`${releaseDate}T00:00:00`).getTime();

  if (Number.isNaN(releaseTime)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const difference = today.getTime() - releaseTime;
  return Math.floor(difference / 86400000);
}

function buildNewReleasesFromArtists(artists) {
  const releases = [];

  artists.forEach((artist) => {
    const artistReleases =
      Array.isArray(artist.recentReleases) && artist.recentReleases.length > 0
        ? artist.recentReleases
        : artist.latestRelease
        ? [artist.latestRelease]
        : [];

    artistReleases.forEach((release) => {
      if (!release || !release.releaseDate) return;

      const daysAgo = getReleaseDaysAgo(release.releaseDate);

      if (daysAgo === null || daysAgo < 0 || daysAgo > 7) return;

      releases.push({
        id: release.id || `${artist.id}-${release.name}-${release.releaseDate}`,
        artistId: artist.id,
        artistName: artist.name,
        name: release.name || "Untitled Release",
        image: release.image || artist.image || null,
        spotifyUrl:
          release.spotifyUrl ||
          release.spotify_url ||
          `https://open.spotify.com/artist/${artist.id}`,
        releaseDate: release.releaseDate,
        daysAgo,
        totalTracks: release.totalTracks || release.total_tracks || 1,
        tracks: release.tracks || [],
      });
    });
  });

  return releases.sort((a, b) => {
    return new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime();
  });
}

function mergeNewReleases(primaryReleases, databaseReleases) {
  const releasesById = new Map();

  [...databaseReleases, ...primaryReleases].forEach((release) => {
    if (!release) return;

    const key =
      release.id ||
      `${release.artistId}-${release.name}-${release.releaseDate || ""}`;
    releasesById.set(key, release);
  });

  return Array.from(releasesById.values()).sort((a, b) => {
    return new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime();
  });
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function getBackendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://spotify-growth-hub-backend.onrender.com"
  );
}
function cleanSpotifyArtistId(value) {
  if (!value) return "";

  const trimmedValue = String(value).trim();

  if (trimmedValue.includes("open.spotify.com/artist/")) {
    return trimmedValue
      .split("open.spotify.com/artist/")[1]
      .split("?")[0]
      .split("/")[0]
      .trim();
  }

  if (trimmedValue.includes("spotify:artist:")) {
    return trimmedValue
      .split("spotify:artist:")[1]
      .split("?")[0]
      .split("/")[0]
      .trim();
  }

  return trimmedValue.split("?")[0].split("/")[0].trim();
}

function isValidSpotifyArtistId(value) {
  return /^[A-Za-z0-9]{22}$/.test(value);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function parseCsvText(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(current.trim());
      current = "";

      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += character;
  }

  row.push(current.trim());

  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((header) =>
    String(header || "")
      .replace(/^\ufeff/, "")
      .replace(/\u00a0/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
  );

  return rows.slice(1).map((cells) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = cells[index] || "";
    });

    return record;
  });
}

function normalizeManualNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const cleaned = String(value)
    .replace(/%/g, "")
    .replace(/,/g, "")
    .trim();

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function normalizeManualHeaderKey(value) {
  return String(value || "")
    .replace(/^\ufeff/, "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function manualValue(row, keys) {
  const entries = Object.entries(row).map(([key, value]) => [
    normalizeManualHeaderKey(key),
    value,
  ]);

  for (const key of keys) {
    const normalizedKey = normalizeManualHeaderKey(key);
    const exactMatch = entries.find(
      ([entryKey, value]) => entryKey === normalizedKey && value !== ""
    );

    if (exactMatch) return exactMatch[1];
  }

  for (const key of keys) {
    const normalizedKey = normalizeManualHeaderKey(key);
    const fuzzyMatch = entries.find(([entryKey, value]) => {
      if (value === "") return false;

      return (
        entryKey === normalizedKey ||
        entryKey.startsWith(normalizedKey) ||
        normalizedKey.startsWith(entryKey)
      );
    });

    if (fuzzyMatch) return fuzzyMatch[1];
  }

  return "";
}

function normalizeArtistNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// manual_data_fields_persisted: these fields are sent to /api/artist-library so the backend database can save them.
function buildArtistDatabasePayload(artist) {
  const normalizedArtist = normalizeArtist(artist);

  return {
    artistId: normalizedArtist.id,
    name: normalizedArtist.name,
    spotifyUrl: normalizedArtist.spotifyUrl,
    image: normalizedArtist.image,
    genres: normalizedArtist.genres || [],
    streams: normalizedArtist.streams || 0,
    streamsPerTrack: normalizedArtist.streamsPerTrack || 0,
    streamsPercent: normalizedArtist.streamsPercent || 0,
    genre: normalizedArtist.manualGenre || "",
    streamsPerTrack: normalizedArtist.streamsPerTrack || 0,
    radioDiscover: normalizedArtist.radioDiscover || 0,
    manualDataUpdatedAt: normalizedArtist.manualDataUpdatedAt || null,
    radioPercent: normalizedArtist.radioPercent || 0,
    growthPercent: normalizedArtist.growthPercent || 0,
    followers: normalizedArtist.followers || 0,
    popularity: normalizedArtist.popularity || 0,
    totalReleases: normalizedArtist.totalReleases || 0,
    totalTracks: normalizedArtist.totalTracks || 0,
    latestRelease: normalizedArtist.latestRelease || null,
    recentReleases: normalizedArtist.recentReleases || [],
  };
}



function ReleaseTracksModal({ release, onClose }) {
  useEffect(() => {
    if (!release) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [release, onClose]);

  if (!release) return null;

  const tracks =
    release?.tracks && release.tracks.length > 0
      ? release.tracks
      : [
          {
            id: release?.id || "single-release",
            name: release?.name || "Untitled Track",
            trackNumber: 1,
            duration: release?.duration || "",
            artists: [release?.artistName || "Spotify Artist"],
            spotifyUrl: release?.spotifyUrl,
          },
        ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-900 p-5">
          <div className="flex gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-zinc-900">
              {release.image ? (
                <img
                  src={release.image}
                  alt={release.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-400">
                Release Tracks
              </p>
              <h2 className="mt-1 text-2xl font-black uppercase text-white">
                {release.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {release.artistName} · {release.releaseDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-red-400/50 hover:text-red-300"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-950 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-400 [&::-webkit-scrollbar-thumb:hover]:bg-green-300">
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={track.id || `${release.id}-${track.trackNumber || index}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {track.trackNumber || index + 1}. {track.name || release.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {(track.artists || [release.artistName]).join(", ")}
                    {track.explicit ? " · Explicit" : ""}
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  {track.duration ? (
                    <p className="text-xs text-zinc-500">{track.duration}</p>
                  ) : null}

                  <Link
                    href={track.spotifyUrl || release.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-400 text-black hover:bg-green-300"
                  >
                    <SpotifyIcon />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function ReleaseCard({ release, onViewTracks }) {
  const trackCount = Number(release.totalTracks || 1);
  const trackLabel = `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`;

  return (
    <article
      onClick={() => onViewTracks(release)}
      className="group w-full min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-zinc-900 bg-black transition duration-300 hover:border-green-400/60 hover:shadow-[0_0_24px_rgba(34,197,94,0.08)]"
    >
      <div className="h-[118px] w-full overflow-hidden bg-zinc-950">
        {release.image ? (
          <img
            src={release.image}
            alt={release.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-black text-green-400">
            {release.name?.charAt(0) || "N"}
          </div>
        )}
      </div>

      <div className="min-h-[104px] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-green-400">
            {formatDaysAgo(release.daysAgo)}
          </p>

          <span className="text-lg leading-none text-zinc-500">...</span>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
          {release.name}
        </h3>

        <p className="mt-2 truncate text-xs font-medium text-zinc-300">
          {trackLabel}
        </p>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {release.artistName}
        </p>
      </div>
    </article>
  );
}


function AddArtistModal({ isOpen, currentArtistIds, onAddArtist, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [directArtist, setDirectArtist] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");

  function cleanSpotifyArtistId(value) {
    if (!value) return "";

    const trimmedValue = String(value).trim();

    if (trimmedValue.includes("open.spotify.com/artist/")) {
      return trimmedValue
        .split("open.spotify.com/artist/")[1]
        .split("?")[0]
        .split("/")[0]
        .trim();
    }

    if (trimmedValue.includes("spotify:artist:")) {
      return trimmedValue
        .split("spotify:artist:")[1]
        .split("?")[0]
        .split("/")[0]
        .trim();
    }

    return trimmedValue.split("?")[0].split("/")[0].trim();
  }

  function isValidSpotifyArtistId(value) {
    return /^[A-Za-z0-9]{22}$/.test(value);
  }

  function normalizeDirectArtist(data, originalArtistId) {
    const artist = data.artist || {};
    const releases = data.releases || [];
    const latestRelease = releases[0] || null;

    return normalizeArtist({
      id: artist.id || originalArtistId,
      name: artist.name || "Spotify Artist",
      image: artist.image || null,
      followers: artist.followers || 0,
      popularity: artist.popularity || 0,
      genres: artist.genres || [],
      spotifyUrl:
        artist.spotifyUrl ||
        artist.external_urls?.spotify ||
        `https://open.spotify.com/artist/${artist.id || originalArtistId}`,
      streams: 0,
      growthPercent: 0,
      followers7Days: 0,
      totalReleases: artist.totalReleases || releases.length || 0,
      totalTracks:
        artist.totalTracks ||
        releases.reduce(
          (total, release) => total + Number(release.totalTracks || 0),
          0
        ),
      latestRelease: latestRelease
        ? {
            id: latestRelease.id,
            name: latestRelease.name,
            releaseDate: latestRelease.releaseDate,
            totalTracks: latestRelease.totalTracks,
            spotifyUrl: latestRelease.spotifyUrl,
            image: latestRelease.image,
            tracks: latestRelease.tracks || [],
          }
        : null,
      recentReleases: releases.map((release) => ({
        id: release.id,
        name: release.name,
        releaseDate: release.releaseDate,
        totalTracks: release.totalTracks,
        spotifyUrl: release.spotifyUrl,
        image: release.image,
        tracks: release.tracks || [],
      })),
      isManuallyAdded: true,
    });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = setTimeout(async () => {
      const trimmedQuery = query.trim();

      setMessage("");
      setDirectArtist(null);

      if (trimmedQuery.length < 2) {
        setResults([]);
        return;
      }

      const possibleArtistId = cleanSpotifyArtistId(trimmedQuery);

      try {
        setIsSearching(true);

        if (isValidSpotifyArtistId(possibleArtistId)) {
          const response = await fetch(
            `/api/spotify/artist-details?artistId=${encodeURIComponent(
              possibleArtistId
            )}`,
            { cache: "no-store" }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.message || data.error || "Artist ID lookup failed."
            );
          }

          setDirectArtist(normalizeDirectArtist(data, possibleArtistId));
          setResults([]);
          return;
        }

        const response = await fetch(
          `/api/spotify/search-artists?q=${encodeURIComponent(trimmedQuery)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Search failed.");
        }

        setResults((data.artists || []).map(normalizeArtist));
      } catch (error) {
        setMessage(error.message);
        setResults([]);
        setDirectArtist(null);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [query, isOpen]);

  async function handleAddArtist(artist) {
    const addedArtist = normalizeArtist({
      ...artist,
      isManuallyAdded: true,
      streams: artist.streams || 0,
      growthPercent: artist.growthPercent || 0,
      followers7Days: getFollowers7DaysValue(artist),
    });

    await onAddArtist(addedArtist);
    setMessage(`${artist.name} added to Artist Library.`);
  }

  function renderArtistCard(artist) {
    const isAlreadyAdded = currentArtistIds.includes(artist.id);

    return (
      <article
        key={artist.id}
        className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-zinc-900">
            {artist.image ? (
              <img
                src={artist.image}
                alt={artist.name}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">
              {artist.name}
            </h3>

            <p className="mt-1 truncate text-xs text-zinc-500">{artist.id}</p>

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-black px-2 py-1 text-[10px] font-semibold text-zinc-400">
                {formatNumber(artist.followers)} followers
              </span>

              <span className="rounded-full bg-black px-2 py-1 text-[10px] font-semibold text-zinc-400">
                {artist.popularity}/100 popularity
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => handleAddArtist(artist)}
            disabled={isAlreadyAdded}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              isAlreadyAdded
                ? "cursor-not-allowed bg-zinc-900 text-zinc-500"
                : "bg-green-400 text-black hover:bg-green-300"
            }`}
          >
            {isAlreadyAdded ? "Added" : "Add Artist"}
          </button>

          <Link
            href={artist.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-white hover:border-green-400/60 hover:text-green-400"
          >
            <SpotifyIcon />
          </Link>
        </div>
      </article>
    );
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-900 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Add Artist</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Search by artist name or paste a Spotify Artist ID/link.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-red-400/50 hover:text-red-300"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="Search artist name, paste artist ID, or paste Spotify artist link..."
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-400/60"
          />

          {message ? (
            <p className="mt-3 text-sm text-green-400">{message}</p>
          ) : null}

          {isSearching ? (
            <p className="mt-4 text-sm text-zinc-500">Searching...</p>
          ) : null}

          <div className="mt-5 max-h-[52vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-950 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-400 [&::-webkit-scrollbar-thumb:hover]:bg-green-300">
            {directArtist ? (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-green-400">
                  Artist ID Match
                </p>
                {renderArtistCard(directArtist)}
              </div>
            ) : results.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {results.map((artist) => renderArtistCard(artist))}
              </div>
            ) : query.trim().length >= 2 && !isSearching ? (
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
                <p className="text-sm font-semibold text-white">
                  No artists found.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Try searching with a different artist name or paste the Spotify
                  Artist ID.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
                <p className="text-sm font-semibold text-white">
                  Start searching.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Type an artist name or paste a Spotify Artist ID.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({ label, sortKey, activeSortKey, sortDirection, onSort }) {
  return (
    <th className="px-4 py-4 font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 uppercase tracking-[0.16em] text-black transition hover:text-zinc-900"
      >
        {label}
        <SortArrow active={activeSortKey === sortKey} direction={sortDirection} />
      </button>
    </th>
  );
}

function ArtistsTable({
  artists,
  isLoading,
  onRemoveArtist,
  onCopied,
  sortKey,
  sortDirection,
  onSort,
}) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-black">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[70px_1.4fr_120px_100px_110px_120px_110px_130px_100px_100px_90px_130px_80px] gap-4 border-b border-zinc-900 px-4 py-4 last:border-b-0"
          >
            {Array.from({ length: 13 }).map((__, cellIndex) => (
              <div
                key={cellIndex}
                className="h-5 animate-pulse rounded bg-zinc-900"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-900 bg-black p-5">
        <p className="text-sm font-semibold text-white">No artists found.</p>
        <p className="mt-1 text-sm text-zinc-500">Try adding a new artist.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-900 bg-black [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-950 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-400 [&::-webkit-scrollbar-thumb:hover]:bg-green-300">
      <table className="min-w-[1680px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-emerald-400 bg-green-400 text-[11px] text-black">
          <tr>
            <SortableHeader label="URL" sortKey="url" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Artist" sortKey="name" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Genre" sortKey="genre" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Popularity" sortKey="popularity" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Streams" sortKey="streams" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Streams/Track" sortKey="streamsPerTrack" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Streams %" sortKey="streamsPercent" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Radio/Discover" sortKey="radioDiscover" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Radio %" sortKey="radioPercent" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="7 Days" sortKey="followers7Days" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Tracks" sortKey="tracks" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Latest" sortKey="latest" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <th className="px-4 py-4 font-semibold uppercase tracking-[0.16em] text-black">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {artists.map((artist) => {
            const growthNumber = Number(artist.growthPercent || 0);
            const followers7DaysNumber = Number(artist.followers7Days || 0);
            const genre = artist.manualGenre || "—";

            return (
              <tr
                key={artist.id}
                className="border-b border-zinc-900 transition hover:bg-zinc-950/70 last:border-b-0"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={artist.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-400 text-black transition hover:bg-green-300"
                      title="Open on Spotify"
                    >
                      <SpotifyIcon />
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        const didCopy = await copyToClipboard(artist.spotifyUrl);
                        onCopied(
                          didCopy
                            ? `${artist.name} Spotify link copied.`
                            : "Could not copy Spotify link."
                        );
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 transition hover:border-green-400/60 hover:text-green-400"
                      title="Copy Spotify link"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <Link
                    href={`/my-artists/${artist.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                      {artist.image ? (
                        <img
                          src={artist.image}
                          alt={artist.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-black text-green-400">
                          {artist.name?.charAt(0) || "A"}
                        </div>
                      )}
                    </div>

                    <p className="truncate font-semibold text-white">
                      {artist.name}
                    </p>
                  </Link>
                </td>

                <td className="px-4 py-4">
                  <span className="rounded-lg border border-zinc-800 bg-black px-2 py-1 text-xs font-semibold text-zinc-300">
                    {genre}
                  </span>
                </td>

                <td className="px-4 py-4 font-semibold text-white">
                  {artist.popularity}/100
                </td>

                <td className="px-4 py-4 font-semibold text-white">
                  {formatNumber(artist.streams)}
                </td>

                <td className="px-4 py-4 font-semibold text-white">
                  {formatOptionalNumber(artist.streamsPerTrack)}
                </td>

                <td
                  className={`px-4 py-4 font-semibold ${
                    Number(artist.streamsPercent || 0) > 0
                      ? "text-green-400"
                      : Number(artist.streamsPercent || 0) < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {formatOptionalPercent(artist.streamsPercent)}
                </td>

                <td className="px-4 py-4 font-semibold text-white">
                  {formatOptionalNumber(artist.radioDiscover)}
                </td>

                <td
                  className={`px-4 py-4 font-semibold ${
                    Number(artist.radioPercent || 0) > 0
                      ? "text-green-400"
                      : Number(artist.radioPercent || 0) < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {formatOptionalPercent(artist.radioPercent)}
                </td>

                <td
                  className={`px-4 py-4 font-semibold ${
                    followers7DaysNumber > 0
                      ? "text-green-400"
                      : followers7DaysNumber < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {formatDelta(artist.followers7Days)}
                </td>

                <td className="px-4 py-4 font-semibold text-white">
                  {formatNumber(artist.totalTracks)}
                </td>

                <td className="px-4 py-4">
                  <span className="block max-w-[130px] truncate text-xs text-zinc-400">
                    {artist.latestRelease?.name || "—"}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onRemoveArtist(artist.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 transition hover:border-red-400/60 hover:text-red-300"
                    title="Remove artist"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MyArtistsPage() {
  const [baseArtists, setBaseArtists] = useState([]);
  const [databaseArtists, setDatabaseArtists] = useState([]);
  const [addedArtists, setAddedArtists] = useState([]);
  const [removedArtistIds, setRemovedArtistIds] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [sortKey, setSortKey] = useState("streams");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isAddArtistOpen, setIsAddArtistOpen] = useState(false);
  const [isUploadingManualData, setIsUploadingManualData] = useState(false);
  const [manualDataUpdatedAt, setManualDataUpdatedAt] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNewReleasesOpen, setIsNewReleasesOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDatabaseArtists() {
    const backendBaseUrl = getBackendBaseUrl();

    const response = await fetch(`${backendBaseUrl}/api/artist-library`, {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.message || "Could not load database artists."
      );
    }

    return (data.artists || []).map(normalizeArtist);
  }

  async function loadManualArtistData() {
    const backendBaseUrl = getBackendBaseUrl();

    const response = await fetch(`${backendBaseUrl}/api/artist-library/manual-data`, {
      cache: "no-store",
    });

    if (!response.ok) return [];

    const data = await response.json();

    return data.items || data.artists || [];
  }

  function applyManualDataToArtists(artistsToMerge, manualRows) {
    const manualById = new Map();
    const manualByName = new Map();

    manualRows.forEach((row) => {
      const normalizedRow = normalizeArtist({
        id: row.artistId || row.artist_id || row.id,
        artistId: row.artistId || row.artist_id || row.id,
        name: row.name,
        genre: row.genre,
        popularity: row.popularity,
        streams: row.streams,
        streamsPerTrack: row.streamsPerTrack ?? row.streams_per_track,
        radioDiscover: row.radioDiscover ?? row.radio_discover,
        manualDataUpdatedAt:
          row.manualDataUpdatedAt ||
          row.manual_data_updated_at ||
          row.updatedAt ||
          row.updated_at,
      });

      if (normalizedRow.id) manualById.set(normalizedRow.id, normalizedRow);
      if (normalizedRow.name) {
        manualByName.set(normalizeArtistNameKey(normalizedRow.name), normalizedRow);
      }
    });

    return artistsToMerge.map((artist) => {
      const manual =
        manualById.get(artist.id) ||
        manualByName.get(normalizeArtistNameKey(artist.name));

      if (!manual) return artist;

      return normalizeArtist({
        ...artist,
        manualGenre: manual.manualGenre || artist.manualGenre || "",
        popularity: manual.popularity || artist.popularity || 0,
        streams: manual.streams || artist.streams || 0,
        streamsPerTrack: manual.streamsPerTrack ?? artist.streamsPerTrack ?? null,
        radioDiscover: manual.radioDiscover ?? artist.radioDiscover ?? null,
        manualDataUpdatedAt: manual.manualDataUpdatedAt || artist.manualDataUpdatedAt || null,
      });
    });
  }

  function getLatestManualDataUpdate(artistsToCheck) {
    const latest = artistsToCheck
      .map((artist) => artist.manualDataUpdatedAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    return latest || null;
  }

  async function syncFollowerSnapshots(artistsToSync) {
    const backendBaseUrl = getBackendBaseUrl();

    if (artistsToSync.length === 0) return [];

    const response = await fetch(
      `${backendBaseUrl}/api/artist-library/sync-followers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artists: artistsToSync.map((artist) => ({
            artistId: artist.id,
            followers: Number(artist.followers || 0),
          })),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.message || "Could not sync followers.");
    }

    return data.artists || [];
  }

  async function saveArtistToDatabase(artist) {
    const backendBaseUrl = getBackendBaseUrl();
    const normalizedArtist = normalizeArtist(artist);

    const response = await fetch(`${backendBaseUrl}/api/artist-library`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildArtistDatabasePayload(normalizedArtist)),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail ||
          data.message ||
          `Could not save ${normalizedArtist.name} to database.`
      );
    }

    return normalizedArtist;
  }

  async function saveMissingArtistsToDatabase(artistsToSave, savedArtists) {
    const savedArtistIds = new Set(savedArtists.map((artist) => artist.id));

    const missingArtists = artistsToSave.filter((artist) => {
      return artist?.id && !savedArtistIds.has(artist.id);
    });

    const saved = [];
    const failed = [];

    for (const artist of missingArtists) {
      try {
        const savedArtist = await saveArtistToDatabase(artist);
        saved.push(savedArtist);
      } catch (error) {
        failed.push({
          artist,
          message: error.message,
        });
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

    return { saved, failed };
  }

  async function handleRefreshArtists() {
    const backendBaseUrl = getBackendBaseUrl();

    try {
      setIsRefreshing(true);
      setToastMessage("Loading Spotify artists...");

      const artistsResponse = await fetch("/api/spotify/artists", {
        cache: "no-store",
      });

      const spotifyData = await artistsResponse.json();

      if (!artistsResponse.ok) {
        throw new Error(
          spotifyData.message ||
            spotifyData.error ||
            "Could not load Spotify artists."
        );
      }

      const nextBaseArtists = (spotifyData.artists || []).map(normalizeArtist);
      setBaseArtists(nextBaseArtists);

      const currentDatabaseArtists = await loadDatabaseArtists();

      const activeBaseArtistsToSave = nextBaseArtists.filter((artist) => {
        return artist?.id && !removedArtistIds.includes(artist.id);
      });

      setToastMessage("Saving missing artists to database...");

      const { saved, failed } = await saveMissingArtistsToDatabase(
        activeBaseArtistsToSave,
        currentDatabaseArtists
      );

      setToastMessage(
        saved.length > 0
          ? `Saved ${saved.length} missing artists. Syncing metadata...`
          : "All visible artists are already saved. Syncing metadata..."
      );

      const syncResponse = await fetch(
        `${backendBaseUrl}/api/artist-library/sync-metadata`,
        {
          method: "POST",
          cache: "no-store",
        }
      );

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(
          syncData.detail ||
            syncData.message ||
            "Could not refresh artist metadata."
        );
      }

      const nextDatabaseArtists = await loadDatabaseArtists();
      const manualRows = await loadManualArtistData();
      const mergedDatabaseArtists = applyManualDataToArtists(nextDatabaseArtists, manualRows);

      setDatabaseArtists(mergedDatabaseArtists);
      setManualDataUpdatedAt(getLatestManualDataUpdate(mergedDatabaseArtists));
      setNewReleases(buildNewReleasesFromArtists(mergedDatabaseArtists));

      const failedText =
        failed.length > 0
          ? ` ${failed.length} failed: ${failed
              .slice(0, 3)
              .map((item) => item.artist?.name)
              .join(", ")}.`
          : "";

      setToastMessage(
        `Artist library refreshed. Saved ${saved.length}. Synced ${
          syncData.synced || nextDatabaseArtists.length
        }/${syncData.total || nextDatabaseArtists.length}.${failedText}`
      );
    } catch (error) {
      setToastMessage(`Refresh failed: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    try {
      const savedAddedArtists = JSON.parse(
        localStorage.getItem(ADDED_ARTISTS_STORAGE_KEY) || "[]"
      );
      const savedRemovedArtistIds = JSON.parse(
        localStorage.getItem(REMOVED_ARTISTS_STORAGE_KEY) || "[]"
      );

      setAddedArtists(savedAddedArtists.map(normalizeArtist));
      setRemovedArtistIds(savedRemovedArtistIds);
    } catch {
      setAddedArtists([]);
      setRemovedArtistIds([]);
    }
  }, []);

  useEffect(() => {
    async function loadArtists() {
      try {
        const artistsResponse = await fetch("/api/spotify/artists", {
          cache: "no-store",
        });

        const spotifyData = await artistsResponse.json();

        if (!artistsResponse.ok) {
          throw new Error(
            spotifyData.message ||
              spotifyData.error ||
              "Failed to load artists."
          );
        }

        const nextBaseArtists = (spotifyData.artists || []).map(normalizeArtist);

        setBaseArtists(nextBaseArtists);

        const nextDatabaseArtists = await loadDatabaseArtists();
        const manualRows = await loadManualArtistData();
        const mergedDatabaseArtists = applyManualDataToArtists(nextDatabaseArtists, manualRows);

        setDatabaseArtists(mergedDatabaseArtists);
        setManualDataUpdatedAt(getLatestManualDataUpdate(mergedDatabaseArtists));
        setNewReleases(
          mergeNewReleases(
            spotifyData.newReleases || [],
            buildNewReleasesFromArtists(mergedDatabaseArtists)
          )
        );

        try {
          const syncedFollowers = await syncFollowerSnapshots(nextBaseArtists);
          const followersByArtistId = new Map(
            syncedFollowers.map((item) => [
              item.artistId || item.artist_id || item.id,
              toNumber(
                item.followers7Days ??
                  item.followers_7_days ??
                  item.followers7days ??
                  item.growth7Days ??
                  item.growth_7_days ??
                  item.growth7d ??
                  item.growth_7d,
                0
              ),
            ])
          );

          const applySyncedFollowerGrowth = (currentArtists) =>
            currentArtists.map((artist) => {
              if (!followersByArtistId.has(artist.id)) return artist;

              return {
                ...artist,
                followers7Days: followersByArtistId.get(artist.id),
              };
            });

          setBaseArtists(applySyncedFollowerGrowth);
          setDatabaseArtists(applySyncedFollowerGrowth);
        } catch (syncError) {
          console.warn(syncError);
        }
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadArtists();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timeoutId = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [toastMessage]);

    const activeBaseArtists = baseArtists.filter((artist) => {
    return !removedArtistIds.includes(artist.id);
  });

  const databaseArtistIds = databaseArtists.map((artist) => artist.id);

  const activeAddedArtists = addedArtists.filter((artist) => {
    const isRemoved = removedArtistIds.includes(artist.id);
    const existsInBase = activeBaseArtists.some(
      (baseArtist) => baseArtist.id === artist.id
    );
    const existsInDatabase = databaseArtistIds.includes(artist.id);

    return !isRemoved && !existsInBase && !existsInDatabase;
  });

  const databaseArtistMap = new Map(
    databaseArtists.map((artist) => [artist.id, artist])
  );

  const mergedBaseArtists = activeBaseArtists.map((artist) => {
    const databaseArtist = databaseArtistMap.get(artist.id);

    if (!databaseArtist) {
      return artist;
    }

    return {
      ...artist,
      streams: databaseArtist.streams || artist.streams || 0,
      streamsPerTrack:
        databaseArtist.streamsPerTrack || artist.streamsPerTrack || null,
      streamsPercent:
        databaseArtist.streamsPercent || artist.streamsPercent || null,
      radioDiscover:
        databaseArtist.radioDiscover || artist.radioDiscover || null,
      radioPercent:
        databaseArtist.radioPercent || artist.radioPercent || null,
      growthPercent:
        databaseArtist.growthPercent || artist.growthPercent || 0,
      followers: databaseArtist.followers || artist.followers || 0,
      followers7Days:
        Number(databaseArtist.followers7Days || 0) !== 0
          ? databaseArtist.followers7Days
          : artist.followers7Days || 0,
      popularity: databaseArtist.popularity || artist.popularity || 0,
      genres: artist.genres || [],
      manualGenre: databaseArtist.manualGenre || artist.manualGenre || null,
      manualDataUpdatedAt:
        databaseArtist.manualDataUpdatedAt || artist.manualDataUpdatedAt || null,
      totalReleases:
        databaseArtist.totalReleases || artist.totalReleases || 0,
      totalTracks:
        databaseArtist.totalTracks || artist.totalTracks || 0,
      latestRelease:
        databaseArtist.latestRelease || artist.latestRelease || null,
    };
  });

  const databaseOnlyArtists = databaseArtists.filter((artist) => {
    const isRemoved = removedArtistIds.includes(artist.id);
    const existsInBase = activeBaseArtists.some(
      (baseArtist) => baseArtist.id === artist.id
    );

    return !isRemoved && !existsInBase;
  });

  const artists = [
    ...mergedBaseArtists,
    ...databaseOnlyArtists,
    ...activeAddedArtists,
  ];

  const genreSummaryCards = useMemo(() => {
    const grouped = new Map();

    artists.forEach((artist) => {
      const genre = artist.manualGenre || null;

      if (!genre) return;

      const current =
        grouped.get(genre) ||
        {
          genre,
          tracks: 0,
          streams: 0,
          radioDiscover: 0,
        };

      current.tracks += Number(artist.totalTracks || 0);
      current.streams += Number(artist.streams || 0);
      current.radioDiscover += Number(artist.radioDiscover || 0);

      grouped.set(genre, current);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        radioPercent: item.streams > 0 ? (item.radioDiscover / item.streams) * 100 : 0,
        radioPerTrack: item.tracks > 0 ? item.radioDiscover / item.tracks : 0,
      }))
      .sort((a, b) => b.radioPercent - a.radioPercent)
      .slice(0, 5);
  }, [artists]);

  const sortedArtists = useMemo(() => {
    const nextArtists = [...artists];

    nextArtists.sort((a, b) => {
      let aValue;
      let bValue;

      if (sortKey === "url") {
        aValue = a.spotifyUrl || "";
        bValue = b.spotifyUrl || "";
      } else if (sortKey === "name") {
        aValue = a.name || "";
        bValue = b.name || "";
      } else if (sortKey === "streams") {
        aValue = Number(a.streams || 0);
        bValue = Number(b.streams || 0);
      } else if (sortKey === "streamsPerTrack") {
        aValue = Number(a.streamsPerTrack || 0);
        bValue = Number(b.streamsPerTrack || 0);
      } else if (sortKey === "streamsPercent") {
        aValue = Number(a.streamsPercent || 0);
        bValue = Number(b.streamsPercent || 0);
      } else if (sortKey === "radioDiscover") {
        aValue = Number(a.radioDiscover || 0);
        bValue = Number(b.radioDiscover || 0);
      } else if (sortKey === "radioPercent") {
        aValue = Number(a.radioPercent || 0);
        bValue = Number(b.radioPercent || 0);
      } else if (sortKey === "followers7Days") {
        aValue = Number(a.followers7Days || 0);
        bValue = Number(b.followers7Days || 0);
      } else if (sortKey === "genre") {
        aValue = a.genres?.[0] || "Spotify Artist";
        bValue = b.genres?.[0] || "Spotify Artist";
      } else if (sortKey === "releases") {
        aValue = Number(a.totalReleases || 0);
        bValue = Number(b.totalReleases || 0);
      } else if (sortKey === "tracks") {
        aValue = Number(a.totalTracks || 0);
        bValue = Number(b.totalTracks || 0);
      } else if (sortKey === "latest") {
        aValue = a.latestRelease?.name || "";
        bValue = b.latestRelease?.name || "";
      } else {
        aValue = Number(a.popularity || 0);
        bValue = Number(b.popularity || 0);
      }

      if (typeof aValue === "string" || typeof bValue === "string") {
        const result = String(aValue).localeCompare(String(bValue));
        return sortDirection === "asc" ? result : -result;
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    return nextArtists;
  }, [artists, sortKey, sortDirection]);

  const currentArtistIds = useMemo(() => {
    return artists.map((artist) => artist.id);
  }, [artists]);

  function handleSort(nextSortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(nextSortKey);

    if (["name", "genre", "latest", "url"].includes(nextSortKey)) {
      setSortDirection("asc");
    } else {
      setSortDirection("desc");
    }
  }

  function handleDownloadArtistsTable() {
    const columns = [
      "URL",
      "Artist",
      "Genre",
      "Popularity",
      "Streams",
      "Streams/Track",
      "Streams %",
      "Radio/Discover",
      "Radio %",
      "7 Days",
      "Tracks",
      "Latest",
    ];

    const rows = sortedArtists.map((artist) => [
      artist.spotifyUrl,
      artist.name,
      artist.manualGenre || "",
      artist.popularity || 0,
      artist.streams || 0,
      artist.streamsPerTrack ?? "",
      artist.streamsPercent ?? "",
      artist.radioDiscover ?? "",
      artist.radioPercent ?? "",
      artist.followers7Days || 0,
      artist.totalTracks || 0,
      artist.latestRelease?.name || "",
    ]);

    const csv = [columns, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "artist-table.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage("Artist table downloaded.");
  }

  function findArtistForManualRow(row) {
    const artistName = manualValue(row, ["artist", "artist name", "name", "spotify artist"]);
    const url = manualValue(row, ["url", "spotify url", "spotify", "spotify artist url"]);
    const artistIdFromUrl = cleanSpotifyArtistId(url);

    if (artistIdFromUrl && isValidSpotifyArtistId(artistIdFromUrl)) {
      const matchById = artists.find((artist) => artist.id === artistIdFromUrl);
      if (matchById) return matchById;
    }

    const normalizedName = normalizeArtistNameKey(artistName);

    if (!normalizedName) return null;

    return (
      artists.find((artist) => normalizeArtistNameKey(artist.name) === normalizedName) ||
      artists.find((artist) => normalizeArtistNameKey(artist.name).includes(normalizedName)) ||
      null
    );
  }

  function buildManualArtistUpdate(artist, row) {
    const genre = manualValue(row, [
      "genre",
      "manual genre",
      "uploaded genre",
      "primary genre",
      "artist genre",
      "genres",
    ]);
    const popularity = normalizeManualNumber(manualValue(row, ["popularity"]));
    const streams = normalizeManualNumber(manualValue(row, ["streams"]));
    const streamsPerTrack = normalizeManualNumber(
      manualValue(row, ["streams/track", "streams per track", "streams track"])
    );
    const radioDiscover = normalizeManualNumber(
      manualValue(row, ["radio/discover", "radio discover", "radio"])
    );

    return normalizeArtist({
      ...artist,
      manualGenre: genre || artist.manualGenre || "",
      popularity: popularity ?? artist.popularity ?? 0,
      streams: streams ?? artist.streams ?? 0,
      streamsPerTrack: streamsPerTrack ?? artist.streamsPerTrack ?? null,
      radioDiscover: radioDiscover ?? artist.radioDiscover ?? null,
      manualDataUpdatedAt: new Date().toISOString(),
    });
  }

  async function handleManualDataUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setIsUploadingManualData(true);
      setToastMessage("Uploading manual artist data...");

      const text = await file.text();
      const rows = parseCsvText(text);

      if (rows.length === 0) {
        throw new Error("The uploaded CSV is empty.");
      }

      const updates = rows
        .map((row) => {
          const artist = findArtistForManualRow(row);

          if (!artist) return null;

          return buildManualArtistUpdate(artist, row);
        })
        .filter(Boolean);

      if (updates.length === 0) {
        throw new Error("No matching artists found. Include Artist or URL in the CSV.");
      }

      const backendBaseUrl = getBackendBaseUrl();

      const response = await fetch(`${backendBaseUrl}/api/artist-library/manual-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artists: updates.map(buildArtistDatabasePayload),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Could not save manual artist data.");
      }

      const nextDatabaseArtists = await loadDatabaseArtists();
      const manualRows = await loadManualArtistData();
      const mergedDatabaseArtists = applyManualDataToArtists(nextDatabaseArtists, manualRows);

      setDatabaseArtists(mergedDatabaseArtists);
      setManualDataUpdatedAt(getLatestManualDataUpdate(mergedDatabaseArtists));
      setNewReleases(buildNewReleasesFromArtists(mergedDatabaseArtists));
      setToastMessage(`Saved manual data for ${updates.length} artist${updates.length === 1 ? "" : "s"} to database.`);
    } catch (error) {
      setToastMessage(`Manual upload failed: ${error.message}`);
    } finally {
      setIsUploadingManualData(false);
      event.target.value = "";
    }
  }

  async function handleAddArtist(artist) {
    const backendBaseUrl = getBackendBaseUrl();

    try {
      const response = await fetch(`${backendBaseUrl}/api/artist-library`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildArtistDatabasePayload(artist)),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Could not add artist.");
      }

      setDatabaseArtists((currentArtists) => {
        return [
          ...currentArtists.filter(
            (currentArtist) => currentArtist.id !== artist.id
          ),
          artist,
        ];
      });

      setRemovedArtistIds((currentIds) => {
        const nextIds = currentIds.filter((id) => id !== artist.id);

        localStorage.setItem(
          REMOVED_ARTISTS_STORAGE_KEY,
          JSON.stringify(nextIds)
        );

        return nextIds;
      });

      setToastMessage(`${artist.name} added to database.`);
    } catch (error) {
      setToastMessage(`Database save failed: ${error.message}`);
    }
  }

  async function handleRemoveArtist(artistId) {
    const backendBaseUrl = getBackendBaseUrl();

    try {
      const response = await fetch(
        `${backendBaseUrl}/api/artist-library/${artistId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Could not remove artist."
        );
      }

      setDatabaseArtists((currentArtists) =>
        currentArtists.filter((artist) => artist.id !== artistId)
      );

      setBaseArtists((currentArtists) =>
        currentArtists.filter((artist) => artist.id !== artistId)
      );

      setAddedArtists((currentArtists) => {
        const nextArtists = currentArtists.filter(
          (artist) => artist.id !== artistId
        );

        localStorage.setItem(
          ADDED_ARTISTS_STORAGE_KEY,
          JSON.stringify(nextArtists)
        );

        return nextArtists;
      });

      setToastMessage("Artist removed from database.");
    } catch (error) {
      setToastMessage(`Database remove failed: ${error.message}`);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-green-400/30 bg-green-400 px-4 py-3 text-sm font-semibold text-black shadow-2xl">
          {toastMessage}
        </div>
      ) : null}

      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="w-full">
          <h1 className="text-3xl font-semibold tracking-tight">
            My Artists{" "}
            <span className="text-zinc-500">
              ({isLoading ? "..." : artists.length})
            </span>
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {formatManualUpdateAge(manualDataUpdatedAt)}
          </p>

          {genreSummaryCards.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {genreSummaryCards.map((card) => (
                <div
                  key={card.genre}
                  className="min-h-[168px] rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-xl shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate text-base font-black text-white">{card.genre}</h3>
                    <span className="shrink-0 rounded-full bg-green-400 px-3 py-1 text-xs font-black text-black">
                      {formatCardPercent(card.radioPercent)}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 text-sm font-semibold text-zinc-400">
                    <div className="flex justify-between gap-3">
                      <span>Tracks</span>
                      <span className="text-white">{formatNumber(card.tracks)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Streams</span>
                      <span className="text-white">{formatNumber(card.streams)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Radio/Discover</span>
                      <span className="text-white">{formatNumber(card.radioDiscover)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Radio/Track</span>
                      <span className="text-white">{formatNumber(Math.round(card.radioPerTrack))}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleRefreshArtists}
            disabled={isRefreshing}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-white transition hover:border-green-400/60 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            title={isRefreshing ? "Refreshing artists" : "Refresh artists"}
            aria-label={isRefreshing ? "Refreshing artists" : "Refresh artists"}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`h-5 w-5 rotate-90 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 0 1-15.3 6.4" />
              <path d="M3 12a9 9 0 0 1 15.3-6.4" />
              <path d="M6 18H3v3" />
              <path d="M18 6h3V3" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleDownloadArtistsTable}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-white transition hover:border-green-400/60 hover:text-green-400"
            title="Download artist table"
            aria-label="Download artist table"
          >
            <DownloadIcon />
          </button>

          <input
            id="manual-artist-data-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={handleManualDataUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => document.getElementById("manual-artist-data-upload")?.click()}
            disabled={isUploadingManualData}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-white transition hover:border-green-400/60 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            title="Upload manual artist data"
            aria-label="Upload manual artist data"
          >
            <UploadIcon />
          </button>

          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => setIsAddArtistOpen(true)}
              className="flex h-11 min-w-[104px] items-center justify-center whitespace-nowrap rounded-xl bg-green-400 px-4 text-sm font-semibold text-black transition hover:bg-green-300"
            >
              Add Artist
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="font-semibold text-red-300">
            Could not load Spotify artists.
          </p>
          <p className="mt-2 text-sm text-red-200/80">{errorMessage}</p>
        </section>
      ) : (
        <>
          <section className="mb-6 overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-950/60 p-6">
            <button
              type="button"
              onClick={() => setIsNewReleasesOpen((current) => !current)}
              className="mb-5 flex w-full items-start justify-between gap-4 text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-white">
                  New Releases{" "}
                  <span className="text-zinc-500">
                    ({isLoading ? "..." : newReleases.length})
                  </span>
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Releases from the last 7 days.
                </p>
              </div>

              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition ${
                  isNewReleasesOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                ˅
              </span>
            </button>

            {isNewReleasesOpen ? (
              isLoading ? (
                <div className="new-releases-carousel pb-3">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[228px] w-full min-w-0 animate-pulse rounded-2xl border border-zinc-900 bg-black"
                    />
                  ))}
                </div>
              ) : newReleases.length > 0 ? (
                <div className="new-releases-carousel cursor-grab pb-3 pr-2 active:cursor-grabbing">
                  {newReleases.map((release) => (
                    <ReleaseCard
                      key={`${release.id}-${release.artistId}-${release.releaseDate}`}
                      release={release}
                      onViewTracks={setSelectedRelease}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                  <p className="text-sm font-semibold text-white">
                    No new releases in the last 7 days.
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    When one of your artists releases new music, it will appear
                    here automatically.
                  </p>
                </div>
              )
            ) : null}
          </section>

          <ArtistsTable
            artists={sortedArtists}
            isLoading={isLoading}
            onRemoveArtist={handleRemoveArtist}
            onCopied={setToastMessage}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </>
      )}

      <style jsx global>{`
        .new-releases-carousel {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: calc((100% - 5rem) / 6);
          gap: 1rem;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: #10b981 #000000;
        }

        .new-releases-carousel::-webkit-scrollbar {
          height: 8px;
        }

        .new-releases-carousel::-webkit-scrollbar-track {
          background: #000000;
          border-radius: 9999px;
        }

        .new-releases-carousel::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #10b981 0%, #22c55e 100%);
          border-radius: 9999px;
        }

        @media (max-width: 1535px) {
          .new-releases-carousel {
            grid-auto-columns: calc((100% - 4rem) / 5);
          }
        }

        @media (max-width: 1279px) {
          .new-releases-carousel {
            grid-auto-columns: calc((100% - 3rem) / 4);
          }
        }

        @media (max-width: 1023px) {
          .new-releases-carousel {
            grid-auto-columns: calc((100% - 2rem) / 3);
          }
        }

        @media (max-width: 767px) {
          .new-releases-carousel {
            grid-auto-columns: calc((100% - 1rem) / 2);
          }
        }

        @media (max-width: 520px) {
          .new-releases-carousel {
            grid-auto-columns: 82%;
          }
        }
      `}</style>

      <AddArtistModal
        isOpen={isAddArtistOpen}
        currentArtistIds={currentArtistIds}
        onAddArtist={handleAddArtist}
        onClose={() => setIsAddArtistOpen(false)}
      />

      <ReleaseTracksModal
        release={selectedRelease}
        onClose={() => setSelectedRelease(null)}
      />
    </main>
  );
}