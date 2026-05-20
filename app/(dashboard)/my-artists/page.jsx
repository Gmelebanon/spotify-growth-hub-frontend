"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 17L17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M12 1.8C6.37 1.8 1.8 6.37 1.8 12S6.37 22.2 12 22.2 22.2 17.63 22.2 12 17.63 1.8 12 1.8Zm4.68 14.7a.77.77 0 0 1-1.06.25c-2.9-1.78-6.56-2.18-10.86-1.19a.77.77 0 1 1-.34-1.5c4.71-1.08 8.75-.62 12.01 1.38.36.22.48.7.25 1.06Zm1.25-2.78a.96.96 0 0 1-1.32.32c-3.32-2.04-8.39-2.63-12.32-1.44a.96.96 0 1 1-.56-1.84c4.49-1.36 10.07-.7 13.88 1.64.45.28.59.87.32 1.32Zm.11-2.9C14.06 8.46 7.5 8.25 3.7 9.47a1.15 1.15 0 0 1-.7-2.2c4.36-1.4 11.61-1.15 16.21 1.58a1.15 1.15 0 1 1-1.17 1.97Z" />
    </svg>
  );
}

function formatDaysAgo(daysAgo) {
  if (typeof daysAgo !== "number") return "Recently";
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "1 day ago";
  return `${daysAgo} days ago`;
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

function ReleaseTracksModal({ release, onClose }) {
  if (!release) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl">
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
            className="rounded-xl border border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-300 hover:border-green-400/60 hover:text-green-400"
          >
            Close
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          {release.tracks && release.tracks.length > 0 ? (
            <div className="space-y-2">
              {release.tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {track.trackNumber}. {track.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {track.artists?.join(", ")}
                      {track.explicit ? " · Explicit" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-xs text-zinc-500">{track.duration}</p>

                    <Link
                      href={track.spotifyUrl}
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
          ) : (
            <p className="text-sm text-zinc-500">No tracks found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReleaseCard({ release, onViewTracks }) {
  return (
    <article
      className={`group flex min-h-[150px] overflow-hidden rounded-3xl border bg-black transition duration-300 hover:shadow-[0_0_32px_rgba(34,197,94,0.08)] ${
        release.isNewRelease
          ? "border-red-500/80 hover:border-red-400"
          : "border-zinc-900 hover:border-green-400/60"
      }`}
    >
      <div className="relative h-auto w-[140px] shrink-0 overflow-hidden bg-zinc-950">
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

        {release.isNewRelease && (
          <div className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            New
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green-400">
              {formatDaysAgo(release.daysAgo)}
            </p>

            <p className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold uppercase text-zinc-400">
              {release.totalTracks} tracks
            </p>
          </div>

          <h3 className="text-lg font-black uppercase leading-tight text-white">
            {release.name}
          </h3>

          <p className="mt-2 text-sm font-medium text-zinc-400">
            {release.artistName}
          </p>

          <p className="mt-1 text-xs text-zinc-600">{release.releaseDate}</p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={release.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            title="Open release on Spotify"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-400 text-black transition hover:bg-green-300"
          >
            <SpotifyIcon />
          </Link>

          <button
            type="button"
            onClick={() => onViewTracks(release)}
            title="View tracks"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black text-white transition hover:border-green-400/60 hover:text-green-400"
          >
            <EyeIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function ArtistCard({ artist }) {
  const genres =
    artist.genres && artist.genres.length > 0
      ? artist.genres.slice(0, 2).join(" / ")
      : "Spotify Artist";

  const growthNumber = Number(artist.growthPercent || 0);

  return (
    <article className="group relative w-full overflow-hidden rounded-3xl border border-zinc-900 bg-black transition duration-300 hover:border-green-400/60 hover:shadow-[0_0_32px_rgba(34,197,94,0.08)] sm:w-[280px]">
      <Link
        href={`/my-artists/${artist.id}`}
        aria-label={`View details for ${artist.name}`}
        className="absolute inset-0 z-10"
      />

      <div className="relative h-[400px]">
        {artist.image ? (
          <img
            src={artist.image}
            alt={artist.name}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-70 grayscale transition duration-300 group-hover:opacity-90 group-hover:grayscale-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            <span className="text-5xl font-semibold text-green-400">
              {artist.name?.charAt(0) || "A"}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-green-500/20 via-black/35 to-black" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />

        <div className="pointer-events-none relative z-20 flex h-full flex-col justify-end p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-green-400">
              {genres}
            </p>

            <h2 className="text-3xl font-black uppercase leading-[0.95] tracking-tight text-white">
              {artist.name}
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Streams
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatNumber(artist.streams)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Growth
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    growthNumber > 0
                      ? "text-green-400"
                      : growthNumber < 0
                      ? "text-red-400"
                      : "text-zinc-400"
                  }`}
                >
                  {formatGrowth(artist.growthPercent)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Followers
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatNumber(artist.followers)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Popularity
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {artist.popularity}/100
                </p>
              </div>
            </div>

            <div className="pointer-events-auto relative z-30 mt-4 flex items-center gap-2">
              <Link
                href={artist.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                title="Open on Spotify"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-400 text-black transition hover:bg-green-300"
              >
                <SpotifyIcon />
              </Link>

              <Link
                href={`/my-artists/${artist.id}`}
                title="View artist details"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/70 text-white backdrop-blur transition hover:border-green-400/60 hover:text-green-400"
              >
                <EyeIcon />
              </Link>

              <Link
                href={artist.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                title="Open external link"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/70 text-white backdrop-blur transition hover:border-green-400/60 hover:text-green-400"
              >
                <ExternalLinkIcon />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function SearchArtistsBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      try {
        setIsSearching(true);
        setMessage("");

        const response = await fetch(
          `/api/spotify/search-artists?q=${encodeURIComponent(query.trim())}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Search failed.");
        }

        setResults(data.artists || []);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [query]);

  async function copyArtistId(artistId) {
    try {
      await navigator.clipboard.writeText(artistId);
      setMessage("Artist ID copied. Add it to lib/spotify-artists.js.");
    } catch {
      setMessage("Could not copy Artist ID.");
    }
  }

  return (
    <section className="mb-6 rounded-3xl border border-zinc-900 bg-zinc-950/60 p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Add Artist Search</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Search Spotify by artist name, then copy the Artist ID into your
          artist config file.
        </p>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search artist name..."
        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-400/60"
      />

      {message ? <p className="mt-3 text-sm text-green-400">{message}</p> : null}

      {isSearching ? (
        <p className="mt-4 text-sm text-zinc-500">Searching...</p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {results.map((artist) => (
            <article
              key={artist.id}
              className="rounded-2xl border border-zinc-900 bg-black p-4"
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
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {artist.id}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => copyArtistId(artist.id)}
                  className="flex-1 rounded-xl bg-green-400 px-3 py-2 text-xs font-semibold text-black hover:bg-green-300"
                >
                  Copy ID
                </button>

                <Link
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-white hover:border-green-400/60 hover:text-green-400"
                >
                  <ExternalLinkIcon />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LoadingCard() {
  return (
    <article className="w-full overflow-hidden rounded-3xl border border-zinc-900 bg-black sm:w-[280px]">
      <div className="h-[400px] animate-pulse bg-zinc-950 p-5">
        <div className="mt-48">
          <div className="mb-3 h-3 w-32 rounded bg-zinc-900" />
          <div className="mb-5 h-8 w-40 rounded bg-zinc-900" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 rounded-2xl bg-zinc-900" />
            <div className="h-16 rounded-2xl bg-zinc-900" />
            <div className="h-16 rounded-2xl bg-zinc-900" />
            <div className="h-16 rounded-2xl bg-zinc-900" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MyArtistsPage() {
  const [artists, setArtists] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadArtists() {
      try {
        const response = await fetch("/api/spotify/artists", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || data.error || "Failed to load artists."
          );
        }

        setArtists(data.artists || []);
        setNewReleases(data.newReleases || []);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadArtists();
  }, []);

  const totalStreams = useMemo(() => {
    return artists.reduce((total, artist) => total + Number(artist.streams || 0), 0);
  }, [artists]);

  const genres = useMemo(() => {
    const genreSet = new Set();

    artists.forEach((artist) => {
      artist.genres?.forEach((genre) => genreSet.add(genre));
    });

    return Array.from(genreSet).sort();
  }, [artists]);

  const filteredAndSortedArtists = useMemo(() => {
    let nextArtists = [...artists];

    if (selectedGenre !== "all") {
      nextArtists = nextArtists.filter((artist) =>
        artist.genres?.includes(selectedGenre)
      );
    }

    nextArtists.sort((a, b) => {
      if (sortBy === "followers") {
        return b.followers - a.followers;
      }

      if (sortBy === "streams") {
        return Number(b.streams || 0) - Number(a.streams || 0);
      }

      if (sortBy === "growth") {
        return Number(b.growthPercent || 0) - Number(a.growthPercent || 0);
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }

      return b.popularity - a.popularity;
    });

    return nextArtists;
  }, [artists, selectedGenre, sortBy]);

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mb-8 flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-green-400">
          Spotify Growth Hub
        </p>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Artists</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage artists, track new releases, view release tracks, search
            Spotify, filter by genre, and add manual streams/growth stats.
          </p>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-500">Total Artists</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {isLoading ? "..." : artists.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-500">Total Streams</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {isLoading ? "..." : formatNumber(totalStreams)}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-500">New Releases</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {isLoading ? "..." : newReleases.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-500">Default Sort</p>
          <p className="mt-2 text-lg font-semibold text-white">
            Highest Popularity
          </p>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="font-semibold text-red-300">
            Could not load Spotify artists.
          </p>
          <p className="mt-2 text-sm text-red-200/80">{errorMessage}</p>
        </section>
      ) : (
        <>
          <section className="mb-6 rounded-3xl border border-zinc-900 bg-zinc-950/60 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  New Releases
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Releases from the last 7 days. Releases from the last 2 days
                  are highlighted with a red border.
                </p>
              </div>

              <div className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                Red = New
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-4 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[150px] animate-pulse rounded-3xl border border-zinc-900 bg-black"
                  />
                ))}
              </div>
            ) : newReleases.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-3">
                {newReleases.map((release) => (
                  <ReleaseCard
                    key={`${release.id}-${release.artistId}`}
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
            )}
          </section>

          <SearchArtistsBox />

          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/60 p-7">
            <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Artist Library
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Click any artist card to open the artist details page.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={selectedGenre}
                  onChange={(event) => setSelectedGenre(event.target.value)}
                  className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-sm text-white outline-none focus:border-green-400/60"
                >
                  <option value="all">All genres</option>
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-sm text-white outline-none focus:border-green-400/60"
                >
                  <option value="popularity">Sort by highest popularity</option>
                  <option value="streams">Sort by streams</option>
                  <option value="growth">Sort by growth</option>
                  <option value="followers">Sort by followers</option>
                  <option value="name">Sort by name</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <LoadingCard key={index} />
                  ))
                : filteredAndSortedArtists.map((artist) => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
            </div>
          </section>
        </>
      )}

      <ReleaseTracksModal
        release={selectedRelease}
        onClose={() => setSelectedRelease(null)}
      />
    </main>
  );
}