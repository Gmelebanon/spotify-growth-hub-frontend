const API_BASE = "http://127.0.0.1:8000"

export async function getTrades(accountId: number) {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/trades`)
  if (!res.ok) throw new Error("Failed to fetch trades")
  return res.json()
}

export async function createTrade(
  accountId: number,
  payload: {
    track_name: string
    artist_name: string
    playlist_count: number
    placements: string[]
    status: "active" | "past"
  }
) {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error("Failed to create trade")
  return res.json()
}

export async function analyzePlaylist(
  accountId: number,
  playlistUrl: string
) {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/trades/analyze-playlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlist_url: playlistUrl }),
  })

  if (!res.ok) throw new Error("Failed to analyze playlist")
  return res.json()
}

export async function lookupTracks(
  accountId: number,
  trackUrls: string[]
) {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/trades/lookup-tracks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_urls: trackUrls }),
  })

  if (!res.ok) throw new Error("Failed to look up tracks")
  return res.json()
}

export async function extendTrade(tradeId: number) {
  const res = await fetch(`${API_BASE}/trades/${tradeId}/extend`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to extend trade")
  return res.json()
}

export async function archiveTrade(tradeId: number) {
  const res = await fetch(`${API_BASE}/trades/${tradeId}/archive`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to archive trade")
  return res.json()
}

export async function scanTrade(tradeId: number) {
  const res = await fetch(`${API_BASE}/trades/${tradeId}/scan`, {
    method: "POST",
  })
  if (!res.ok) throw new Error("Failed to scan trade")
  return res.json()
}

export async function deleteTrade(tradeId: number) {
  const res = await fetch(`${API_BASE}/trades/${tradeId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete trade")
  return res.json()
}