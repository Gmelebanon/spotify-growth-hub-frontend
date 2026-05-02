import { apiRequest } from "./client";

export type DashboardSummary = {
  total_playlists: number;
  total_followers: number;
  growth_24h: number;
};

export type GrowthPlaylist = {
  id: number;
  name: string;
  followers: number;
  growth: number;
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

function normalizeSummary(payload: unknown): DashboardSummary {
  const data = (payload ?? {}) as Record<string, unknown>;

  return {
    total_playlists: normalizeNumber(data.total_playlists),
    total_followers: normalizeNumber(data.total_followers),
    growth_24h: normalizeNumber(data.growth_24h),
  };
}

function normalizeGrowthItems(payload: unknown): GrowthPlaylist[] {
  const root = (payload ?? {}) as Record<string, unknown>;

  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.playlists)
    ? root.playlists
    : Array.isArray(root.data)
    ? root.data
    : [];

  return rawItems.map((item, index) => {
    const row = (item ?? {}) as Record<string, unknown>;

    return {
      id: normalizeNumber(row.id) || index + 1,
      name: typeof row.name === "string" ? row.name : "Untitled Playlist",
      followers: normalizeNumber(row.followers),
      growth: normalizeNumber(row.growth),
    };
  });
}

export async function getDashboardSummary(accountId: number): Promise<DashboardSummary> {
  const payload = await apiRequest<unknown>(`/api/accounts/${accountId}/dashboard`);
  return normalizeSummary(payload);
}

export async function getTopPlaylistsByGrowth(accountId: number): Promise<GrowthPlaylist[]> {
  const payload = await apiRequest<unknown>(`/api/accounts/${accountId}/dashboard/top-growth`);
  return normalizeGrowthItems(payload);
}