"use client";

import { useMemo, useState } from "react";

type SongMetric = {
  id: number;
  song: string;
  artist: string;
  released: string;
  days: number;
  streams: number;
  listeners: number;
  saves: number;
  saveRate: number;
  radioRate: number;
  playlists: number;
  completionRate: number | null;
  status: "Keep" | "Flagged" | "Review";
  masterGroup: string;
};

const SONG_METRICS: SongMetric[] = [
  {
    id: 1,
    song: "Say It Right",
    artist: "between., elsewhere., afterhours.",
    released: "2026-01-19",
    days: 66,
    streams: 120792,
    listeners: 63590,
    saves: 1436,
    saveRate: 2.3,
    radioRate: 22.4,
    playlists: 887,
    completionRate: 92.8,
    status: "Keep",
    masterGroup: "between.",
  },
  {
    id: 2,
    song: "So Easy (To Fall In Love) - Chill House Version",
    artist: "afterhours.",
    released: "2026-02-20",
    days: 34,
    streams: 118624,
    listeners: 70414,
    saves: 1393,
    saveRate: 2.0,
    radioRate: 49.3,
    playlists: 849,
    completionRate: 85.8,
    status: "Keep",
    masterGroup: "afterhours.",
  },
  {
    id: 3,
    song: "Don't Be so Shy - Chill House Version",
    artist: "Très Moyen",
    released: "2026-02-27",
    days: 27,
    streams: 103640,
    listeners: 65411,
    saves: 1347,
    saveRate: 2.1,
    radioRate: 58.3,
    playlists: 741,
    completionRate: 90.0,
    status: "Keep",
    masterGroup: "Très Moyen",
  },
  {
    id: 4,
    song: "What Is Love - Deep House Version",
    artist: "between.",
    released: "2026-02-27",
    days: 27,
    streams: 102950,
    listeners: 64789,
    saves: 1411,
    saveRate: 2.2,
    radioRate: 55.3,
    playlists: 735,
    completionRate: 95.3,
    status: "Keep",
    masterGroup: "between.",
  },
  {
    id: 5,
    song: "Glad You Came - Deep House Version",
    artist: "Très Moyen",
    released: "2026-03-06",
    days: 20,
    streams: 99536,
    listeners: 68524,
    saves: 1120,
    saveRate: 1.6,
    radioRate: 62.8,
    playlists: 576,
    completionRate: 93.9,
    status: "Keep",
    masterGroup: "Très Moyen",
  },
  {
    id: 6,
    song: "New Rules - Techno Version",
    artist: "I Overdid It",
    released: "2026-02-27",
    days: 27,
    streams: 80208,
    listeners: 53626,
    saves: 647,
    saveRate: 1.2,
    radioRate: 37.3,
    playlists: 539,
    completionRate: 87.5,
    status: "Keep",
    masterGroup: "I Overdid It",
  },
  {
    id: 7,
    song: "Sweet Nothing - Deep House Version",
    artist: "elsewhere.",
    released: "2026-03-13",
    days: 13,
    streams: 72133,
    listeners: 52420,
    saves: 949,
    saveRate: 1.8,
    radioRate: 58.8,
    playlists: 475,
    completionRate: null,
    status: "Review",
    masterGroup: "elsewhere.",
  },
  {
    id: 8,
    song: "Apologize - Deep House Version",
    artist: "elsewhere.",
    released: "2026-03-06",
    days: 20,
    streams: 70024,
    listeners: 47517,
    saves: 1056,
    saveRate: 2.2,
    radioRate: 50.4,
    playlists: 545,
    completionRate: 95.5,
    status: "Keep",
    masterGroup: "elsewhere.",
  },
  {
    id: 9,
    song: "Locked out of Heaven - Deep House Version",
    artist: "Très Moyen",
    released: "2026-02-01",
    days: 53,
    streams: 68161,
    listeners: 39062,
    saves: 330,
    saveRate: 0.8,
    radioRate: 3.9,
    playlists: 445,
    completionRate: 86.0,
    status: "Flagged",
    masterGroup: "Très Moyen",
  },
  {
    id: 10,
    song: "Midnight Echoes",
    artist: "afterhours.",
    released: "2026-03-01",
    days: 25,
    streams: 64350,
    listeners: 42118,
    saves: 888,
    saveRate: 2.1,
    radioRate: 41.7,
    playlists: 401,
    completionRate: 89.4,
    status: "Keep",
    masterGroup: "afterhours.",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function exportToCsv(rows: SongMetric[]) {
  const headers = [
    "Song",
    "Artist",
    "Released",
    "Days",
    "Streams",
    "Listeners",
    "Saves",
    "Save%",
    "Radio%",
    "Playlists",
    "Completion%",
    "Status",
    "Master Group",
  ];

  const csvRows = rows.map((row) => [
    row.song,
    row.artist,
    row.released,
    row.days,
    row.streams,
    row.listeners,
    row.saves,
    row.saveRate,
    row.radioRate,
    row.playlists,
    row.completionRate ?? "",
    row.status,
    row.masterGroup,
  ]);

  const csv = [headers, ...csvRows]
    .map((line) =>
      line
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "song-metrics.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
        active
          ? "border-green-500 text-white"
          : "border-transparent text-zinc-400 hover:text-white"
      }`}
    >
      {label} ({count})
    </button>
  );
}

function MetricPill({
  value,
  tone,
  suffix = "%",
}: {
  value: number | null;
  tone: "green" | "blue" | "red" | "zinc";
  suffix?: string;
}) {
  const toneClasses = {
    green: "border-green-500/20 bg-green-500/10 text-green-400",
    blue: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    red: "border-red-500/20 bg-red-500/10 text-red-400",
    zinc: "border-zinc-700 bg-zinc-800 text-zinc-400",
  };

  return (
    <span
      className={`inline-flex min-w-[68px] items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {value === null ? "-" : `${value.toFixed(1)}${suffix}`}
    </span>
  );
}

function StatusPill({ status }: { status: SongMetric["status"] }) {
  if (status === "Keep") {
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
        Keep
      </span>
    );
  }

  if (status === "Flagged") {
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
        Flagged
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
      Review
    </span>
  );
}

export default function SongMetricsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "flagged" | "master">("all");

  const filteredRows = useMemo(() => {
    let rows = SONG_METRICS;

    if (tab === "flagged") {
      rows = rows.filter((row) => row.status === "Flagged");
    }

    if (tab === "master") {
      rows = [...rows].sort((a, b) => a.masterGroup.localeCompare(b.masterGroup));
    }

    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter(
      (row) =>
        row.song.toLowerCase().includes(query) ||
        row.artist.toLowerCase().includes(query) ||
        row.masterGroup.toLowerCase().includes(query)
    );
  }, [search, tab]);

  const flaggedCount = SONG_METRICS.filter((row) => row.status === "Flagged").length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Song Metrics
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Track performance across streams, listeners, saves, radio play, and playlist reach.
            </p>
          </div>

          <button
            onClick={() => exportToCsv(filteredRows)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-5 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            Export to CSV
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="mb-5">
            <input
              type="text"
              placeholder="Search song or artist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-6 border-b border-zinc-800">
            <TabButton
              label="All Songs"
              count={SONG_METRICS.length}
              active={tab === "all"}
              onClick={() => setTab("all")}
            />
            <TabButton
              label="Flagged"
              count={flaggedCount}
              active={tab === "flagged"}
              onClick={() => setTab("flagged")}
            />
            <TabButton
              label="By Master Group"
              count={SONG_METRICS.length}
              active={tab === "master"}
              onClick={() => setTab("master")}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <div className="scrollbar-spotify overflow-x-auto">
              <table className="min-w-[1300px] w-full">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr className="text-left">
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Song
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Artist
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Released
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Days
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Streams
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Listeners
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Saves
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Save%
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Radio%
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Playlists
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Completion%
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Del
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-10 text-center text-sm text-zinc-500"
                      >
                        No songs found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-800/80 transition hover:bg-zinc-950"
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="max-w-[320px]">
                            <p className="font-semibold text-white">{row.song}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              Master Group: {row.masterGroup}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-zinc-300">
                          {row.artist}
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-zinc-400">
                          {formatDate(row.released)}
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-white">
                          {row.days}
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-white">
                          {formatNumber(row.streams)}
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-white">
                          {formatNumber(row.listeners)}
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-white">
                          {formatNumber(row.saves)}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <MetricPill value={row.saveRate} tone="red" />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <MetricPill value={row.radioRate} tone="blue" />
                        </td>

                        <td className="px-4 py-4 align-top text-sm font-semibold text-white">
                          {formatNumber(row.playlists)}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <MetricPill
                            value={row.completionRate}
                            tone={row.completionRate === null ? "zinc" : "green"}
                          />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <StatusPill status={row.status} />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <button className="text-sm text-zinc-500 transition hover:text-red-400">
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <span>Showing {filteredRows.length} songs</span>
                    </div>
        </div>
      </div>
    </div>
  );
}