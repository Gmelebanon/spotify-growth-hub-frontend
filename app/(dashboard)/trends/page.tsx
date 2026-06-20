"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

type PlatformKey = "allPlatforms" | "spotify" | "youtube" | "aggregate" | "tiktok";

type TrendRow = {
  position: number;
  artist: string;
  title: string;
};

type TrendsPayload = {
  title: string;
  source_url: string;
  fetched_at: string;
  rows: TrendRow[];
};

type AggregateRow = {
  country?: string;
  itunes?: string;
  spotify?: string;
  apple_music?: string;
  youtube?: string;
  shazam?: string;
  deezer?: string;
};

type ChartConfig = {
  id: string;
  title: string;
  platform: PlatformKey;
  view: string;
  country: string;
};

type SelectedTrendItem = {
  id: string;
  cardId: string;
  cardTitle: string;
  platform: PlatformKey;
  position: number;
  title: string;
  artist: string;
};

type TrendTodoItem = {
  id: number;
  platform: PlatformKey;
  card_title: string;
  position: number;
  title: string;
  artist: string;
  created_at?: string;
};

const MAIN_TABS: { key: PlatformKey; label: string; eyebrow: string }[] = [
  { key: "allPlatforms", label: "All Platforms", eyebrow: "Overview" },
  { key: "spotify", label: "Spotify", eyebrow: "Streams" },
  { key: "youtube", label: "YouTube", eyebrow: "Views" },
  { key: "tiktok", label: "TikTok", eyebrow: "Creations" },
  { key: "aggregate", label: "Aggregate", eyebrow: "Global" },
];

const COUNTRY_LIST = [
  { key: "us", label: "US" },
  { key: "gb", label: "UK" },
  { key: "au", label: "Australia" },
  { key: "de", label: "Germany" },
  { key: "fr", label: "France" },
  { key: "br", label: "Brazil" },
  { key: "es", label: "Spain" },
  { key: "it", label: "Italy" },
];

function buildCards(platform: PlatformKey): ChartConfig[] {
  if (platform === "aggregate") {
    return [
      {
        id: "aggregate-global-weekly",
        title: "Global Weekly",
        platform: "spotify",
        view: "weekly_country",
        country: "global",
      },
      {
        id: "aggregate-global-daily",
        title: "Global Daily",
        platform: "spotify",
        view: "daily_country",
        country: "global",
      },
    ];
  }

  if (platform === "spotify") {
    return [
      {
        id: "spotify-global-weekly",
        title: "Global Weekly",
        platform: "spotify",
        view: "weekly_country",
        country: "global",
      },
      {
        id: "spotify-global-daily",
        title: "Global Daily",
        platform: "spotify",
        view: "daily_country",
        country: "global",
      },
      ...COUNTRY_LIST.flatMap((country) => [
        {
          id: `spotify-${country.key}-weekly`,
          title: `${country.label} Weekly`,
          platform: "spotify" as const,
          view: "weekly_country",
          country: country.key,
        },
        {
          id: `spotify-${country.key}-daily`,
          title: `${country.label} Daily`,
          platform: "spotify" as const,
          view: "daily_country",
          country: country.key,
        },
      ]),
    ];
  }

  if (platform === "youtube") {
    return [
      {
        id: "youtube-global-weekly",
        title: "Global Weekly",
        platform: "youtube",
        view: "global_trending_weekly",
        country: "global",
      },
      {
        id: "youtube-global-daily",
        title: "Global Daily",
        platform: "youtube",
        view: "global_daily",
        country: "global",
      },
      {
        id: "youtube-us-weekly",
        title: "US Weekly",
        platform: "youtube",
        view: "us_weekly",
        country: "us",
      },
      {
        id: "youtube-us-daily",
        title: "US Daily",
        platform: "youtube",
        view: "us_trending_daily",
        country: "us",
      },
    ];
  }

  if (platform === "tiktok") {
    return [
      {
        id: "tiktok-global-weekly",
        title: "Global Weekly",
        platform: "tiktok",
        view: "weekly_country",
        country: "worldwide",
      },
      {
        id: "tiktok-global-daily",
        title: "Global Daily",
        platform: "tiktok",
        view: "daily_country",
        country: "worldwide",
      },
      {
        id: "tiktok-us-weekly",
        title: "US Weekly",
        platform: "tiktok",
        view: "weekly_country",
        country: "us",
      },
      {
        id: "tiktok-us-daily",
        title: "US Daily",
        platform: "tiktok",
        view: "daily_country",
        country: "us",
      },
    ];
  }

  return COUNTRY_LIST.flatMap((country) => [
    {
      id: `${platform}-${country.key}-weekly`,
      title: `${country.label} Weekly`,
      platform,
      view: "weekly_country",
      country: country.key,
    },
    {
      id: `${platform}-${country.key}-daily`,
      title: `${country.label} Daily`,
      platform,
      view: "daily_country",
      country: country.key,
    },
  ]);
}

function rowKey(row: TrendRow, index: number) {
  return `${row.position}-${row.artist}-${row.title}-${index}`;
}

function trendItemId(config: ChartConfig, row: TrendRow, index: number) {
  return `${config.id}-${rowKey(row, index)}`;
}

function buildSpotifySearchUrl(row: TrendRow) {
  const query = [row.title, row.artist]
    .filter(Boolean)
    .join(" ")
    .trim();

  return `https://open.spotify.com/search/${encodeURIComponent(query || row.title || "")}`;
}

function formatLastSync(value: string | null) {
  if (!value) return "Not synced yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return date.toLocaleString("en-US", {
    timeZone: "Asia/Beirut",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TrackCard({
  config,
  searchQuery,
  refreshKey,
  onSynced,
  selectedItems,
  onToggleItem,
  onRangeSelect,
  onAddCard,
}: {
  config: ChartConfig;
  searchQuery: string;
  refreshKey: number;
  onSynced: (value: string) => void;
  selectedItems: Record<string, SelectedTrendItem>;
  onToggleItem: (item: SelectedTrendItem, checked: boolean, index: number) => void;
  onRangeSelect: (items: SelectedTrendItem[], index: number) => void;
  onAddCard: (items: SelectedTrendItem[]) => void;
}) {
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams({
        platform: config.platform,
        view: config.view,
        country: config.country,
        limit: "100",
        refresh: refreshKey > 0 ? "true" : "false",
      });

      const response = await fetch(
        `${API_BASE_URL}/api/trends/chart?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = (await response.json()) as TrendsPayload;
      setPayload(data);

      if (data.fetched_at) {
        onSynced(data.fetched_at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chart.");
    } finally {
      setIsLoading(false);
    }
  }, [config.country, config.platform, config.view, onSynced, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = payload?.rows ?? [];
  const filteredRows = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) return rows;

    return rows.filter((row) =>
      `${row.title} ${row.artist}`.toLowerCase().includes(normalized),
    );
  }, [rows, searchQuery]);

  const visibleItems = useMemo(
    () =>
      filteredRows.slice(0, 100).map((row, index) => ({
        id: trendItemId(config, row, index),
        cardId: config.id,
        cardTitle: config.title,
        platform: config.platform,
        position: row.position,
        title: row.title || "-",
        artist: row.artist || "-",
      })),
    [config, filteredRows],
  );

  return (
    <article className="h-[430px] min-h-[430px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/85 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-emerald-500 px-4 py-3">
        <h2 className="truncate text-base font-black text-black">{config.title}</h2>
        {config.platform !== "aggregate" && config.platform !== "allPlatforms" && (
          <button
            type="button"
            onClick={() => onAddCard(visibleItems)}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-black text-white transition hover:bg-zinc-900"
          >
            Add
          </button>
        )}
      </div>

      <div className="h-[382px] overflow-y-auto px-4 py-3 trends-green-scrollbar">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm font-bold text-zinc-500">
            Loading...
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="font-black text-red-300">Could not load</p>
            <p className="mt-2 text-xs text-zinc-500">{error}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-zinc-500">
            {config.platform === "tiktok" ? "Waiting for TikTok database sync" : "No chart rows available"}
          </div>
        ) : (
          filteredRows.slice(0, 100).map((row, index) => {
            const item = visibleItems[index];
            const isSelected = Boolean(selectedItems[item.id]);

            return (
              <div
                key={item.id}
                className="flex min-h-[46px] items-center gap-3 border-b border-zinc-900 py-[9px] transition hover:bg-zinc-900/60"
              >
                <a
                  href={buildSpotifySearchUrl(row)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 text-left text-[13px] font-black leading-[1.35] text-white transition hover:text-emerald-300"
                  title={`Open ${row.title || "song"} on Spotify`}
                >
                  <span className="text-emerald-300">{row.position}</span>{" "}
                  {row.title || "-"}{" "}
                  <span className="font-medium text-zinc-400">- {row.artist || "-"}</span>
                </a>

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) => {
                    if (event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey) {
                      onRangeSelect(visibleItems, index);
                      return;
                    }

                    onToggleItem(item, event.target.checked, index);
                  }}
                  className="h-4 w-4 shrink-0 accent-emerald-400"
                  aria-label={`Select ${row.title || "song"}`}
                />
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}


function AllPlatformsOverview({
  searchQuery,
  refreshKey,
  onSynced,
  selectedItems,
  onToggleItem,
  onRangeSelect,
  onAddCard,
  todoItems,
  onDeleteTodo,
}: {
  searchQuery: string;
  refreshKey: number;
  onSynced: (value: string) => void;
  selectedItems: Record<string, SelectedTrendItem>;
  onToggleItem: (item: SelectedTrendItem, checked: boolean, index: number) => void;
  onRangeSelect: (items: SelectedTrendItem[], index: number) => void;
  onAddCard: (items: SelectedTrendItem[]) => void;
  todoItems: TrendTodoItem[];
  onDeleteTodo: (id: number) => void;
}) {
  const overviewCards = buildCards("allPlatforms");

  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[3fr_1fr]">
      <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-950/85 shadow-2xl shadow-black/20">
        <div className="border-b border-zinc-800 bg-emerald-500 px-5 py-4 text-black">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-black/70">
            Overview
          </p>
          <h2 className="mt-1 text-2xl font-black">Top Songs</h2>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {overviewCards.map((card) => (
            <TrackCard
              key={`${card.id}-${refreshKey}`}
              config={card}
              searchQuery={searchQuery}
              refreshKey={refreshKey}
              onSynced={onSynced}
              selectedItems={selectedItems}
              onToggleItem={onToggleItem}
              onRangeSelect={onRangeSelect}
              onAddCard={onAddCard}
            />
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/85 p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-black text-white">To do list</h2>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300">
            {todoItems.length} active
          </span>
        </div>

        <div className="mt-5 max-h-[720px] space-y-4 overflow-y-auto pr-2 trends-green-scrollbar">
          {todoItems.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-sm font-semibold text-zinc-500">
              Select songs from Spotify, YouTube, or TikTok, then press Add or Send All.
            </div>
          ) : (
            todoItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-800 bg-black/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black leading-snug text-white">
                      {item.artist} - {item.title}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-zinc-400">
                      {item.card_title} · #{item.position}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                      {item.platform}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTodo(item.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 transition hover:border-red-400 hover:text-red-300"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function AggregateTable({
  searchQuery,
  refreshKey,
  onSynced,
}: {
  searchQuery: string;
  refreshKey: number;
  onSynced: (value: string) => void;
}) {
  const [payload, setPayload] = useState<(Omit<TrendsPayload, "rows"> & { rows: AggregateRow[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams({
        platform: "aggregate",
        view: "global",
        country: "global",
        limit: "250",
        refresh: refreshKey > 0 ? "true" : "false",
      });

      const response = await fetch(
        `${API_BASE_URL}/api/trends/chart?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = (await response.json()) as Omit<TrendsPayload, "rows"> & { rows: AggregateRow[] };
      setPayload(data);

      if (data.fetched_at) {
        onSynced(data.fetched_at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load aggregate table.");
    } finally {
      setIsLoading(false);
    }
  }, [onSynced, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = (payload?.rows ?? []) as AggregateRow[];
  const filteredRows = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) return rows;

    return rows.filter((row) =>
      [
        row.country,
        row.itunes,
        row.spotify,
        row.apple_music,
        row.youtube,
        row.shazam,
        row.deezer,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [rows, searchQuery]);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/85 shadow-2xl shadow-black/20">
      <div className="max-h-[620px] overflow-auto trends-green-scrollbar">
        {isLoading ? (
          <div className="flex h-[340px] items-center justify-center text-sm font-bold text-zinc-500">
            Loading...
          </div>
        ) : error ? (
          <div className="flex h-[340px] flex-col items-center justify-center px-4 text-center">
            <p className="font-black text-red-300">Could not load</p>
            <p className="mt-2 text-xs text-zinc-500">{error}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex h-[340px] items-center justify-center text-sm font-bold text-zinc-500">
            No aggregate rows available
          </div>
        ) : (
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-500 text-black">
              <tr className="border-b border-emerald-400 text-[10px] font-black uppercase tracking-[0.22em] text-black">
                <th className="w-[130px] px-5 py-4">Country</th>
                <th className="px-5 py-4">iTunes</th>
                <th className="px-5 py-4">Spotify</th>
                <th className="px-5 py-4">Apple Music</th>
                <th className="px-5 py-4">YouTube</th>
                <th className="px-5 py-4">Shazam</th>
                <th className="px-5 py-4">Deezer</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr
                  key={`${row.country}-${index}`}
                  className="border-b border-zinc-900 transition hover:bg-zinc-900/60"
                >
                  <td className="whitespace-nowrap px-5 py-4 font-black text-white">
                    {row.country || "-"}
                  </td>
                  <td className="px-5 py-4 text-zinc-300">{row.itunes || "-"}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.spotify || "-"}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.apple_music || "-"}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.youtube || "-"}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.shazam || "-"}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.deezer || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function TrendsPage() {
  const [activeTab, setActiveTab] = useState<PlatformKey>("allPlatforms");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedTrendItem>>({});
  const [todoItems, setTodoItems] = useState<TrendTodoItem[]>([]);
  const [history, setHistory] = useState<Record<string, SelectedTrendItem>[]>([]);
  const [lastSelectedIndexByCard, setLastSelectedIndexByCard] = useState<Record<string, number>>({});

  const cards = useMemo(() => buildCards(activeTab), [activeTab]);

  const isOverviewTab = activeTab === "allPlatforms" || activeTab === "aggregate";

  const cardGridClass = isOverviewTab
    ? "grid gap-4 sm:grid-cols-2"
    : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

  const handleSynced = useCallback((value: string) => {
    setLastSync((current) => {
      if (!current) return value;

      const currentTime = new Date(current).getTime();
      const nextTime = new Date(value).getTime();

      if (Number.isNaN(nextTime)) return current;
      if (Number.isNaN(currentTime)) return value;

      return nextTime > currentTime ? value : current;
    });
  }, []);

  const loadTodoItems = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trends/todo`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = (await response.json()) as { items: TrendTodoItem[] };
      setTodoItems(data.items ?? []);
    } catch {
      setTodoItems([]);
    }
  }, []);

  useEffect(() => {
    loadTodoItems();
  }, [loadTodoItems]);

  const addTodoItems = useCallback(
    async (items: SelectedTrendItem[]) => {
      if (items.length === 0) return;

      const response = await fetch(`${API_BASE_URL}/api/trends/todo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = (await response.json()) as { items: TrendTodoItem[] };
      setTodoItems(data.items ?? []);

      setSelectedItems((current) => {
        const next = { ...current };

        items.forEach((item) => {
          delete next[item.id];
        });

        return next;
      });
    },
    [],
  );

  const handleDeleteTodo = useCallback(
    async (id: number) => {
      const response = await fetch(`${API_BASE_URL}/api/trends/todo/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      setTodoItems((current) => current.filter((item) => item.id !== id));
    },
    [],
  );

  const pushSelectionHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-14), selectedItems]);
  }, [selectedItems]);

  const handleToggleItem = useCallback(
    (item: SelectedTrendItem, checked: boolean, index: number) => {
      pushSelectionHistory();
      setSelectedItems((current) => {
        const next = { ...current };

        if (checked) {
          next[item.id] = item;
        } else {
          delete next[item.id];
        }

        return next;
      });
      setLastSelectedIndexByCard((current) => ({ ...current, [item.cardId]: index }));
    },
    [pushSelectionHistory],
  );

  const handleRangeSelect = useCallback(
    (items: SelectedTrendItem[], index: number) => {
      const selectedItem = items[index];
      if (!selectedItem) return;

      pushSelectionHistory();
      const previousIndex = lastSelectedIndexByCard[selectedItem.cardId] ?? index;
      const start = Math.min(previousIndex, index);
      const end = Math.max(previousIndex, index);
      const rangeItems = items.slice(start, end + 1);

      setSelectedItems((current) => {
        const next = { ...current };

        rangeItems.forEach((item) => {
          next[item.id] = item;
        });

        return next;
      });

      setLastSelectedIndexByCard((current) => ({
        ...current,
        [selectedItem.cardId]: index,
      }));
    },
    [lastSelectedIndexByCard, pushSelectionHistory],
  );

  const handleAddCard = useCallback(
    async (items: SelectedTrendItem[]) => {
      const selectedFromCard = items.filter((item) => selectedItems[item.id]);

      if (selectedFromCard.length === 0) return;

      pushSelectionHistory();
      await addTodoItems(selectedFromCard);
    },
    [addTodoItems, pushSelectionHistory, selectedItems],
  );

  const handleDeselectAll = useCallback(() => {
    pushSelectionHistory();
    setSelectedItems({});
  }, [pushSelectionHistory]);

  const handleUndo = useCallback(() => {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;

      setSelectedItems(previous);
      return current.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  const selectedCount = Object.keys(selectedItems).length;

  const handleSendSelected = useCallback(async () => {
    await addTodoItems(Object.values(selectedItems));
  }, [addTodoItems, selectedItems]);

  return (
    <main className="min-h-screen bg-black px-6 py-6 text-white">
      <section className="rounded-[28px] bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-6 shadow-2xl shadow-emerald-950/10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white">
              Social Trends
            </h1>
          </div>

          <div className="flex w-full flex-col items-end gap-3 xl:w-auto xl:max-w-[980px]">
            <div className="flex w-full flex-col items-end gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search playlist..."
                className="h-[48px] min-h-[48px] w-full rounded-[14px] border border-zinc-800 bg-black px-5 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-500 focus:border-zinc-600 sm:w-[260px] xl:w-[360px]"
              />

              {selectedCount > 0 && (
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="h-[48px] min-h-[48px] whitespace-nowrap rounded-[14px] border border-zinc-800 bg-black px-4 text-[14px] font-black text-white transition hover:border-zinc-600 hover:bg-zinc-900"
                  >
                    Deselect all
                  </button>

                  <button
                    type="button"
                    onClick={handleSendSelected}
                    className="h-[48px] min-h-[48px] whitespace-nowrap rounded-[14px] border border-emerald-500 bg-emerald-500 px-4 text-[14px] font-black text-black transition hover:bg-emerald-400"
                  >
                    Send All
                  </button>

                  <button
                    type="button"
                    onClick={handleUndo}
                    className="h-[48px] min-h-[48px] rounded-[14px] border border-zinc-800 bg-black px-4 text-lg font-black text-white transition hover:border-zinc-600 hover:bg-zinc-900 [&>span]:rotate-90"
                    title="Undo selection"
                  >
                    <span className="inline-block rotate-90">↶</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="h-[48px] min-h-[48px] rounded-[14px] border border-zinc-800 bg-zinc-950 px-6 text-sm font-black text-white transition hover:border-zinc-600 hover:bg-zinc-900"
              >
                Refresh
              </button>
            </div>

            <p className="text-right text-xs text-zinc-500">
              Last sync:{" "}
              <span className="font-semibold text-zinc-300">
                {formatLastSync(lastSync)}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {MAIN_TABS.map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-emerald-400 bg-emerald-500 text-black shadow-lg shadow-emerald-950/40"
                    : "border-zinc-800 bg-zinc-950/80 text-white hover:border-emerald-500/50"
                }`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.24em] ${
                    isActive ? "text-black/60" : "text-zinc-500"
                  }`}
                >
                  {tab.eyebrow}
                </p>
                <p className="mt-2 text-2xl font-black">{tab.label}</p>
              </button>
            );
          })}
        </div>

        {activeTab === "allPlatforms" ? (
          <AllPlatformsOverview
            searchQuery={searchQuery}
            refreshKey={refreshKey}
            onSynced={handleSynced}
            selectedItems={selectedItems}
            onToggleItem={handleToggleItem}
            onRangeSelect={handleRangeSelect}
            onAddCard={handleAddCard}
            todoItems={todoItems}
            onDeleteTodo={handleDeleteTodo}
          />
        ) : activeTab === "aggregate" ? (
          <AggregateTable
            searchQuery={searchQuery}
            refreshKey={refreshKey}
            onSynced={handleSynced}
          />
        ) : (
          <div className={`mt-8 ${cardGridClass}`}>
            {cards.map((card) => (
              <TrackCard
                key={`${card.id}-${refreshKey}`}
                config={card}
                searchQuery={searchQuery}
                refreshKey={refreshKey}
                onSynced={handleSynced}
                selectedItems={selectedItems}
                onToggleItem={handleToggleItem}
                onRangeSelect={handleRangeSelect}
                onAddCard={handleAddCard}
              />
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        .trends-green-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #10b981 #050505;
        }

        .trends-green-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .trends-green-scrollbar::-webkit-scrollbar-track {
          background: #050505;
          border-radius: 999px;
        }

        .trends-green-scrollbar::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 999px;
        }

        .trends-green-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #34d399;
        }
      `}</style>
    </main>
  );
}
