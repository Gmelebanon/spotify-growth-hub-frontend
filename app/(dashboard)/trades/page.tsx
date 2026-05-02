"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useActiveAccountStore } from "@/lib/store/activeAccount"
import {
  getTrades,
  createTrade,
  extendTrade,
  archiveTrade,
  scanTrade,
  deleteTrade,
  analyzePlaylist,
  lookupTracks,
} from "@/lib/api/trades"

type Placement = {
  id: number | string
  playlist_name: string
  note?: string
}

type TradeItem = {
  id: number
  account_id: number
  track_name: string
  artist_name: string
  playlist_count: number
  created_at: string
  expires_at: string
  status: "active" | "past"
  placements: Placement[]
}

type LookupSong = {
  id: string
  url: string
  title: string
  artist: string
  album?: string
  image_url?: string | null
}

type PlaylistPlacement = {
  track_name: string
  artist_name: string
  display_name: string
}

type PlaylistAnalysisResult = {
  playlist_id: string
  name: string
  description?: string
  owner_display_name?: string
  tracks_total: number
  image_url?: string | null
  placements: PlaylistPlacement[]
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function daysLeft(expiresAt: string) {
  const now = new Date()
  const end = new Date(expiresAt)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function progressPercent(createdAt: string, expiresAt: string) {
  const start = new Date(createdAt).getTime()
  const end = new Date(expiresAt).getTime()
  const now = Date.now()

  if (end <= start) return 0

  const total = end - start
  const elapsed = Math.min(Math.max(now - start, 0), total)
  const remaining = total - elapsed

  return Math.max(0, Math.min(100, (remaining / total) * 100))
}

export default function TradesPage() {
  const queryClient = useQueryClient()
  const { activeAccountId } = useActiveAccountStore()

  const [playlistUrl, setPlaylistUrl] = useState("")
  const [trackLinks, setTrackLinks] = useState("")
  const [lookupSongs, setLookupSongs] = useState<LookupSong[]>([])
  const [analysisResult, setAnalysisResult] = useState<PlaylistAnalysisResult | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showPastForm, setShowPastForm] = useState(false)

  const [trackName, setTrackName] = useState("")
  const [artistName, setArtistName] = useState("")
  const [playlistCount, setPlaylistCount] = useState(20)
  const [placementNames, setPlacementNames] = useState("")

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["trades", activeAccountId],
    queryFn: () => getTrades(activeAccountId!),
    enabled: !!activeAccountId,
  })

  const activeTrades: TradeItem[] = data?.active ?? []
  const pastTrades: TradeItem[] = data?.past ?? []

  const invalidateTrades = () =>
    queryClient.invalidateQueries({ queryKey: ["trades", activeAccountId] })

  const createMutation = useMutation({
    mutationFn: (payload: {
      track_name: string
      artist_name: string
      playlist_count: number
      placements: string[]
      status: "active" | "past"
    }) => createTrade(activeAccountId!, payload),
    onSuccess: () => {
      invalidateTrades()
      resetForm()
      setShowCreateForm(false)
      setShowPastForm(false)
    },
  })

  const extendMutation = useMutation({
    mutationFn: (tradeId: number) => extendTrade(tradeId),
    onSuccess: invalidateTrades,
  })

  const archiveMutation = useMutation({
    mutationFn: (tradeId: number) => archiveTrade(tradeId),
    onSuccess: invalidateTrades,
  })

  const scanMutation = useMutation({
    mutationFn: (tradeId: number) => scanTrade(tradeId),
    onSuccess: invalidateTrades,
  })

  const deleteMutation = useMutation({
    mutationFn: (tradeId: number) => deleteTrade(tradeId),
    onSuccess: invalidateTrades,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => analyzePlaylist(activeAccountId!, playlistUrl),
    onSuccess: (result: PlaylistAnalysisResult) => {
      setAnalysisResult(result)
      setPlacementNames(
        (result.placements ?? []).map((p) => p.display_name).join("\n")
      )
      setPlaylistCount(result.placements?.length || result.tracks_total || 0)
      setShowCreateForm(true)
      setShowPastForm(false)
    },
  })

  const lookupMutation = useMutation({
    mutationFn: () =>
      lookupTracks(
        activeAccountId!,
        trackLinks
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      ),
    onSuccess: (result) => {
      const songs = result.results ?? []
      setLookupSongs(songs)

      if (songs.length > 0) {
        setTrackName((prev) => prev || songs[0].title || "")
        setArtistName((prev) => prev || songs[0].artist || "")
        setShowCreateForm(true)
        setShowPastForm(false)
      }
    },
  })

  const canCreate = !!trackName.trim() && !!artistName.trim()

  function resetForm() {
    setTrackName("")
    setArtistName("")
    setPlaylistCount(20)
    setPlacementNames("")
  }

  function submitTrade(status: "active" | "past") {
    if (!canCreate || !activeAccountId) return

    const placements = placementNames
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    createMutation.mutate({
      track_name: trackName.trim(),
      artist_name: artistName.trim(),
      playlist_count: playlistCount,
      placements,
      status,
    })
  }

  function useSongForTrade(song: LookupSong) {
    setTrackName(song.title || "")
    setArtistName(song.artist || "")
    setShowCreateForm(true)
    setShowPastForm(false)
  }

  if (!activeAccountId) {
    return <div className="text-zinc-400">Select an account first.</div>
  }

  if (isLoading) {
    return <div className="text-zinc-400">Loading trades...</div>
  }

  if (isError) {
    return <div className="text-red-400">Failed to load trades.</div>
  }

  return (
    <div className="space-y-6 text-white">
      <style jsx global>{`
        .trade-scroll {
          scrollbar-width: thin;
          scrollbar-color: #ffffff #000000;
        }

        .trade-scroll::-webkit-scrollbar {
          width: 12px;
        }

        .trade-scroll::-webkit-scrollbar-track {
          background: #000000;
          border-radius: 9999px;
        }

        .trade-scroll::-webkit-scrollbar-thumb {
          background: #ffffff;
          border-radius: 9999px;
          border: 2px solid #000000;
        }

        .trade-scroll::-webkit-scrollbar-corner {
          background: #000000;
        }

        .trade-scroll::-webkit-scrollbar-button:single-button {
          display: block;
          background-color: #000000;
          background-repeat: no-repeat;
          background-position: center;
          background-size: 8px 8px;
          height: 14px;
        }

        .trade-scroll::-webkit-scrollbar-button:single-button:vertical:decrement {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='white'><path d='M7 14l5-5 5 5z'/></svg>");
        }

        .trade-scroll::-webkit-scrollbar-button:single-button:vertical:increment {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='white'><path d='M7 10l5 5 5-5z'/></svg>");
        }
      `}</style>

      <div>
        <h1 className="text-3xl font-bold">Trade Manager</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Track placements · 28 day auto-expire · manual remove anytime
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-2xl font-semibold">Analyze Playlist</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Paste a Spotify playlist link to load all playlist songs with artist names.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="Paste Spotify playlist link..."
            className="flex-1 rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={!playlistUrl.trim() || analyzeMutation.isPending}
            className="rounded-xl bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-500 disabled:opacity-50"
          >
            {analyzeMutation.isPending ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {analyzeMutation.isError && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Failed to analyze playlist.
          </div>
        )}

        {analysisResult && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              {analysisResult.image_url ? (
                <img
                  src={analysisResult.image_url}
                  alt={analysisResult.name}
                  className="h-20 w-20 rounded-xl object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-zinc-800" />
              )}

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {analysisResult.name}
                </h3>

                <p className="mt-1 text-sm text-zinc-400">
                  Owner: {analysisResult.owner_display_name || "Unknown"}
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  Tracks found: {analysisResult.placements?.length || 0}
                </p>

                {analysisResult.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                    {analysisResult.description}
                  </p>
                ) : null}
              </div>
            </div>

            {analysisResult.placements?.length > 0 && (
              <div className="mt-4">
                <p className="mb-3 text-sm font-medium text-zinc-300">
                  Loaded songs
                </p>

                <div className="trade-scroll h-[420px] w-full overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 pr-2">
                  <div className="space-y-2 p-3">
                    {analysisResult.placements.map((item, index) => (
                      <div
                        key={`${item.track_name}-${item.artist_name}-${index}`}
                        className="rounded-lg border border-zinc-800 px-3 py-3 text-sm"
                      >
                        <p className="font-medium text-white">
                          {index + 1}. {item.track_name}
                        </p>
                        <p className="mt-1 text-zinc-400">
                          {item.artist_name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-2xl font-semibold">Look Up Songs</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Paste Spotify track links, one per line, to load real track info.
        </p>

        <textarea
          value={trackLinks}
          onChange={(e) => setTrackLinks(e.target.value)}
          placeholder={`https://open.spotify.com/track/...
https://open.spotify.com/track/...
https://open.spotify.com/track/...`}
          className="mt-4 h-32 w-full rounded-xl border border-zinc-700 bg-black p-4 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => lookupMutation.mutate()}
            disabled={!trackLinks.trim() || lookupMutation.isPending}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {lookupMutation.isPending ? "Loading..." : "Load Songs"}
          </button>
        </div>

        {lookupMutation.isError && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Failed to load songs.
          </div>
        )}

        {lookupSongs.length > 0 && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-black">
            {lookupSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-4 border-b border-zinc-800 px-4 py-3 last:border-b-0"
              >
                {song.image_url ? (
                  <img
                    src={song.image_url}
                    alt={song.title}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-zinc-800" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{song.title}</p>
                  <p className="truncate text-sm text-zinc-400">
                    {song.artist}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {song.album || "Unknown Album"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => useSongForTrade(song)}
                    className="rounded-lg border border-green-500/30 px-3 py-2 text-xs text-green-400 transition hover:bg-green-500/10"
                  >
                    Use
                  </button>

                  <span className="text-xs text-zinc-500">{song.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            setShowCreateForm((prev) => !prev)
            setShowPastForm(false)
          }}
          className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-500"
        >
          Add Trade
        </button>

        <button
          onClick={() => {
            setShowPastForm((prev) => !prev)
            setShowCreateForm(false)
          }}
          className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-500"
        >
          Log Past Trade
        </button>
      </div>

      {(showCreateForm || showPastForm) && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-semibold">
            {showPastForm ? "Log Past Trade" : "Add Trade"}
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Track Name
              </label>
              <input
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                placeholder="Track name..."
                className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Artist Name
              </label>
              <input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Artist name..."
                className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Playlist Count
              </label>
              <input
                type="number"
                min={1}
                value={playlistCount}
                onChange={(e) => setPlaylistCount(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Placements
              </label>
              <textarea
                value={placementNames}
                onChange={(e) => setPlacementNames(e.target.value)}
                placeholder={`Song Name — Artist Name
Song Name — Artist Name`}
                className="h-32 w-full rounded-xl border border-zinc-700 bg-black p-4 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => submitTrade(showPastForm ? "past" : "active")}
              disabled={!canCreate || createMutation.isPending}
              className="rounded-xl bg-green-500 px-5 py-3 font-medium text-black transition hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setShowPastForm(false)
                resetForm()
              }}
              className="rounded-xl border border-zinc-700 px-5 py-3 text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold">Active ({activeTrades.length})</h2>

        <div className="mt-4 space-y-4">
          {activeTrades.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">
              No active trades yet.
            </div>
          ) : (
            activeTrades.map((trade) => {
              const remainingDays = daysLeft(trade.expires_at)
              const progress = progressPercent(trade.created_at, trade.expires_at)

              return (
                <div
                  key={trade.id}
                  className="rounded-2xl border border-zinc-700 bg-[#dff0e4] p-4 text-black"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold">
                        {trade.track_name} — {trade.artist_name}
                      </h3>
                      <p className="mt-1 text-sm text-black/70">
                        1 track → {trade.playlist_count} placements · expires{" "}
                        {formatDate(trade.expires_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-4xl font-bold text-green-600">
                        {remainingDays}
                      </p>
                      <p className="text-sm text-black/60">days</p>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => extendMutation.mutate(trade.id)}
                      className="rounded-lg bg-indigo-200 px-3 py-2 text-sm font-medium text-indigo-900 transition hover:bg-indigo-300"
                    >
                      Extend
                    </button>

                    <button
                      onClick={() => scanMutation.mutate(trade.id)}
                      className="rounded-lg bg-green-200 px-3 py-2 text-sm font-medium text-green-900 transition hover:bg-green-300"
                    >
                      Scan
                    </button>

                    <button
                      onClick={() => archiveMutation.mutate(trade.id)}
                      className="rounded-lg bg-amber-200 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-300"
                    >
                      Archive
                    </button>

                    <button
                      onClick={() => deleteMutation.mutate(trade.id)}
                      className="rounded-lg bg-red-200 px-3 py-2 text-sm font-medium text-red-900 transition hover:bg-red-300"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-black/10 bg-black/5 p-4">
                    <p className="mb-3 text-sm font-semibold text-black/70">
                      Found in {trade.placements.length} placement(s)
                    </p>

                    <div className="space-y-2">
                      {trade.placements.map((placement) => (
                        <div
                          key={placement.id}
                          className="rounded-lg bg-white/60 px-3 py-2 text-sm"
                        >
                          • {placement.playlist_name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold">Past ({pastTrades.length})</h2>

        <div className="mt-4 space-y-4">
          {pastTrades.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">
              No past trades yet.
            </div>
          ) : (
            pastTrades.map((trade) => (
              <div
                key={trade.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {trade.track_name} — {trade.artist_name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {trade.playlist_count} placements · logged{" "}
                      {formatDate(trade.created_at)}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteMutation.mutate(trade.id)}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}