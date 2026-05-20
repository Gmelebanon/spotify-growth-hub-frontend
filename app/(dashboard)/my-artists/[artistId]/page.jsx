"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

function ChevronIcon({ isOpen }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function cleanSpotifyArtistId(value) {
  if (!value) return "";

  const rawValue = Array.isArray(value) ? value[0] : value;
  const decodedValue = decodeURIComponent(String(rawValue)).trim();

  if (decodedValue.includes("open.spotify.com/artist/")) {
    return decodedValue
      .split("open.spotify.com/artist/")[1]
      .split("?")[0]
      .split("/")[0];
  }

  if (decodedValue.includes("spotify:artist:")) {
    return decodedValue
      .split("spotify:artist:")[1]
      .split("?")[0]
      .split("/")[0];
  }

  return decodedValue.split("?")[0].split("/")[0];
}

function isValidSpotifyArtistId(artistId) {
  return /^[A-Za-z0-9]{22}$/.test(artistId);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function StatCard({ label, value, subLabel }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/70 p-5 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      {subLabel ? <p className="mt-1 text-xs text-zinc-500">{subLabel}</p> : null}
    </div>
  );
}

function TrackRow({ track }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4 transition hover:border-green-400/40">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">
            {track.trackNumber}. {track.name}
          </p>

          {track.explicit ? (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
              E
            </span>
          ) : null}
        </div>

        <p className="mt-1 truncate text-xs text-zinc-500">
          {track.artists?.join(", ")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="hidden text-xs text-zinc-500 sm:block">{track.duration}</p>

        <Link
          href={track.spotifyUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-400 text-black transition hover:bg-green-300"
          title="Open track on Spotify"
        >
          <SpotifyIcon />
        </Link>
      </div>
    </div>
  );
}

function ReleaseCard({ release, isOpen, onToggle }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-900 bg-black transition hover:border-green-400/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-zinc-950"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-zinc-900">
          {release.image ? (
            <img
              src={release.image}
              alt={release.name}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-green-400">
            {release.type} · {release.releaseDate}
          </p>

          <h3 className="mt-1 truncate text-lg font-black uppercase text-white md:text-xl">
            {release.name}
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            {release.totalTracks} tracks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={release.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-green-400 text-black transition hover:bg-green-300 sm:flex"
            title="Open release on Spotify"
          >
            <SpotifyIcon />
          </Link>

          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 text-zinc-300">
            <ChevronIcon isOpen={isOpen} />
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-zinc-900 p-4">
          {release.tracks?.length > 0 ? (
            <div className="space-y-2">
              {release.tracks.map((track) => (
                <TrackRow key={track.id} track={track} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-sm text-zinc-500">
              No tracks found for this release.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function ArtistDetailsPage() {
  const params = useParams();
  const artistId = cleanSpotifyArtistId(params?.artistId);

  const [artist, setArtist] = useState(null);
  const [releases, setReleases] = useState([]);
  const [openReleaseId, setOpenReleaseId] = useState(null);
  const [releaseSearch, setReleaseSearch] = useState("");
  const [releaseType, setReleaseType] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadArtistDetails() {
      try {
        if (!isValidSpotifyArtistId(artistId)) {
          throw new Error(
            `Invalid artist ID in URL: "${artistId}". Go back to My Artists and click the card again.`
          );
        }

        const response = await fetch(
          `/api/spotify/artist-details?artistId=${encodeURIComponent(
            artistId
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || data.error || "Failed to load artist details."
          );
        }

        setArtist(data.artist);
        setReleases(data.releases || []);
        setOpenReleaseId(data.releases?.[0]?.id || null);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadArtistDetails();
  }, [artistId]);

  const releaseTypes = useMemo(() => {
    const types = new Set();

    releases.forEach((release) => {
      if (release.type) types.add(release.type);
    });

    return Array.from(types).sort();
  }, [releases]);

  const filteredReleases = useMemo(() => {
    return releases.filter((release) => {
      const matchesSearch = release.name
        .toLowerCase()
        .includes(releaseSearch.trim().toLowerCase());

      const matchesType =
        releaseType === "all" ? true : release.type === releaseType;

      return matchesSearch && matchesType;
    });
  }, [releases, releaseSearch, releaseType]);

  const latestRelease = releases[0] || null;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black px-6 py-8 text-white">
        <Link href="/my-artists" className="text-sm text-green-400">
          ← Back to My Artists
        </Link>

        <section className="mt-6 animate-pulse rounded-3xl border border-zinc-900 bg-zinc-950 p-8">
          <div className="h-4 w-40 rounded bg-zinc-900" />
          <div className="mt-5 h-14 w-72 rounded bg-zinc-900" />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="h-28 rounded-3xl bg-zinc-900" />
            <div className="h-28 rounded-3xl bg-zinc-900" />
            <div className="h-28 rounded-3xl bg-zinc-900" />
            <div className="h-28 rounded-3xl bg-zinc-900" />
          </div>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-black px-6 py-8 text-white">
        <Link href="/my-artists" className="text-sm text-green-400">
          ← Back to My Artists
        </Link>

        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="font-semibold text-red-300">
            Could not load artist details.
          </p>
          <p className="mt-2 text-sm text-red-200/80">{errorMessage}</p>

          <div className="mt-4 rounded-xl border border-red-500/20 bg-black/40 p-3">
            <p className="text-xs text-red-200/70">Current URL artist ID:</p>
            <p className="mt-1 break-all text-sm font-semibold text-red-100">
              {artistId || "No artist ID found"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <Link
        href="/my-artists"
        className="inline-flex items-center text-sm font-medium text-green-400 transition hover:text-green-300"
      >
        ← Back to My Artists
      </Link>

      <section className="mt-6 overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-950/60">
        <div className="relative min-h-[520px] p-6 lg:p-8">
          {artist?.image ? (
            <img
              src={artist.image}
              alt={artist.name}
              className="absolute inset-0 h-full w-full object-cover opacity-25 grayscale"
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

          <div className="relative z-10 grid min-h-[460px] gap-8 lg:grid-cols-[320px_1fr] lg:items-end">
            <div className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-black shadow-2xl">
              <div className="relative h-[360px]">
                {artist?.image ? (
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="absolute inset-0 h-full w-full object-cover grayscale"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-6xl font-black text-green-400">
                    {artist?.name?.charAt(0) || "A"}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green-400">
                    Artist Profile
                  </p>
                  <h1 className="mt-2 text-3xl font-black uppercase leading-none text-white">
                    {artist?.name}
                  </h1>
                </div>
              </div>

              <div className="flex gap-2 p-4">
                <Link
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-green-300"
                >
                  <SpotifyIcon />
                  Spotify
                </Link>

                <Link
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 text-white transition hover:border-green-400/60 hover:text-green-400"
                  title="Open external link"
                >
                  <ExternalLinkIcon />
                </Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-400">
                Artist Details
              </p>

              <h2 className="mt-3 max-w-4xl text-5xl font-black uppercase leading-none tracking-tight text-white md:text-7xl">
                {artist?.name}
              </h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {artist?.genres?.length > 0 ? (
                  artist.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-semibold text-green-300"
                    >
                      {genre}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-semibold text-zinc-400">
                    Spotify Artist
                  </span>
                )}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Followers"
                  value={formatNumber(artist?.followers)}
                />
                <StatCard
                  label="Popularity"
                  value={`${artist?.popularity}/100`}
                />
                <StatCard label="Releases" value={artist?.totalReleases} />
                <StatCard label="Tracks" value={artist?.totalTracks} />
              </div>

              {latestRelease ? (
                <div className="mt-6 rounded-3xl border border-zinc-900 bg-black/70 p-4 backdrop-blur">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-zinc-900">
                      {latestRelease.image ? (
                        <img
                          src={latestRelease.image}
                          alt={latestRelease.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-green-400">
                        Latest Release
                      </p>
                      <h3 className="mt-1 truncate text-xl font-black uppercase text-white">
                        {latestRelease.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {latestRelease.releaseDate} · {latestRelease.totalTracks}{" "}
                        tracks
                      </p>
                    </div>

                    <Link
                      href={latestRelease.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-400 text-black transition hover:bg-green-300"
                      title="Open latest release on Spotify"
                    >
                      <SpotifyIcon />
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-900 bg-zinc-950/60 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Releases & Tracks
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Browse releases and expand each card to see its tracks.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={releaseSearch}
              onChange={(event) => setReleaseSearch(event.target.value)}
              placeholder="Search releases..."
              className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-400/60"
            />

            <select
              value={releaseType}
              onChange={(event) => setReleaseType(event.target.value)}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-sm text-white outline-none focus:border-green-400/60"
            >
              <option value="all">All types</option>
              {releaseTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredReleases.length > 0 ? (
            filteredReleases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                isOpen={openReleaseId === release.id}
                onToggle={() =>
                  setOpenReleaseId(
                    openReleaseId === release.id ? null : release.id
                  )
                }
              />
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <p className="text-sm font-semibold text-white">
                No releases found.
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Try changing the search or release type filter.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}