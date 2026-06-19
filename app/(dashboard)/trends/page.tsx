"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

type PlatformKey = "spotify" | "youtube" | "aggregate" | "tiktok";

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

const MAIN_TABS: { key: PlatformKey; label: string; eyebrow: string }[] = [
  { key: "spotify", label: "Spotify", eyebrow: "Streams" },
  { key: "youtube", label: "YouTube", eyebrow: "Views" },
  { key: "tiktok", label: "TikTok", eyebrow: "Creations" },
  { key: "aggregate", label: "Aggregate", eyebrow: "All platforms" },
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
        id: "youtube-global-trending-weekly",
        title: "Global Trending Weekly",
        platform: "youtube",
        view: "global_trending_weekly",
        country: "global",
      },
      {
        id: "youtube-us-trending-daily",
        title: "US Trending Daily",
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
}: {
  config: ChartConfig;
  searchQuery: string;
  refreshKey: number;
  onSynced: (value: string) => void;
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

  return (
    <article className="h-[430px] min-h-[430px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/85 shadow-2xl shadow-black/20">
      <div className="rounded-t-2xl bg-emerald-500 px-4 py-3">
        <h2 className="truncate text-base font-black text-black">{config.title}</h2>
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
          filteredRows.slice(0, 100).map((row, index) => (
            <div
              key={rowKey(row, index)}
              className="flex min-h-[46px] items-center border-b border-zinc-900 py-[9px] transition hover:bg-zinc-900/60"
            >
              <p className="text-left text-[13px] font-black leading-[1.35] text-white">
                <span className="text-emerald-300">{row.position}</span>{" "}
                {row.title || "-"}{" "}
                <span className="font-medium text-zinc-400">- {row.artist || "-"}</span>
              </p>
            </div>
          ))
        )}
      </div>
    </article>
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
  const [activeTab, setActiveTab] = useState<PlatformKey>("spotify");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const cards = useMemo(() => buildCards(activeTab), [activeTab]);

  const cardGridClass =
    activeTab === "aggregate"
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

  return (
    <main className="min-h-screen bg-black px-6 py-6 text-white">
      <section className="rounded-[28px] bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-6 shadow-2xl shadow-emerald-950/10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white">
              Trends
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Weekly and daily trend cards loaded automatically from Kworb.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-[520px]">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search playlist..."
                className="h-[48px] min-h-[48px] flex-1 rounded-[14px] border border-zinc-800 bg-black px-5 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-500 focus:border-zinc-600"
              />

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

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {MAIN_TABS.map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl border p-4 text-left transition ${
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

        {activeTab === "aggregate" ? (
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
