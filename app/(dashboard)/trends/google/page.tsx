"use client";

import { useEffect, useMemo, useState } from "react";

const FALLBACK_QUERY = "afro";
const DEFAULT_QUERY = "";

const GEO_OPTIONS = [
  { label: "Worldwide", value: "" },
  { label: "United States", value: "US" },
  { label: "United Kingdom", value: "GB" },
  { label: "Australia", value: "AU" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "Brazil", value: "BR" },
  { label: "Spain", value: "ES" },
  { label: "Italy", value: "IT" },
];

const TIME_OPTIONS = [
  { label: "Past 7 days", value: "now 7-d" },
  { label: "Past 30 days", value: "today 1-m" },
  { label: "Past 90 days", value: "today 3-m" },
  { label: "Past 12 months", value: "today 12-m" },
];

type WidgetType = "TIMESERIES" | "GEO_MAP" | "RELATED_QUERIES" | "RELATED_TOPICS";

function normalizeKeywords(query: string) {
  const keywords = query
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  return keywords.length ? keywords : [FALLBACK_QUERY];
}

function buildWidgetUrl(type: WidgetType, query: string, geo: string, time: string, retryKey: number) {
  const comparisonItem = normalizeKeywords(query).map((keyword) => ({
    keyword,
    geo,
    time,
  }));

  const req = {
    comparisonItem,
    category: 0,
    property: "",
  };

  const params = new URLSearchParams({
    req: JSON.stringify(req),
    tz: "-180",
    hl: "en-US",
    // Cache-buster so Chrome does not keep a failed Google Trends iframe.
    _: String(retryKey),
  });

  return `https://trends.google.com/trends/embed/explore/${type}?${params.toString()}`;
}

function WidgetCard({
  title,
  type,
  query,
  geo,
  time,
  height,
  retryKey,
}: {
  title: string;
  type: WidgetType;
  query: string;
  geo: string;
  time: string;
  height: number;
  retryKey: number;
}) {
  const src = useMemo(
    () => buildWidgetUrl(type, query, geo, time, retryKey),
    [geo, query, retryKey, time, type],
  );

  return (
    <div className="overflow-hidden rounded-t-[28px] border border-zinc-800 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      <div className="rounded-t-[28px] border-b border-zinc-800 bg-zinc-950 px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">
          {title}
        </p>
      </div>

      <div className="overflow-hidden bg-white">
        <iframe
          key={`${type}-${src}`}
          title={title}
          src={src}
          className="block w-full border-0"
          style={{ height }}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

export default function GoogleTrendsPage() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [geo, setGeo] = useState("");
  const [time, setTime] = useState("now 7-d");
  const [retryKey, setRetryKey] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    setRetryKey((value) => value + 1);
  }, [query, geo, time]);

  // Google Trends iframe occasionally returns a broken frame on first load.
  // Auto-reload a few times so the user does not need to refresh the page manually.
  useEffect(() => {
    if (!isReady || retryKey > 4) return;

    const timeout = window.setTimeout(() => {
      setRetryKey((value) => value + 1);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [isReady, retryKey]);

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white sm:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[28px] bg-zinc-950/90 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white">
              Google Trends
            </h1>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                Topics / keywords
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="afro, amapiano, spotify"
                className="h-12 w-full rounded-2xl border border-zinc-800 bg-black px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                Trending In
              </span>
              <select
                value={geo}
                onChange={(event) => setGeo(event.target.value)}
                className="h-12 w-full rounded-2xl border border-zinc-800 bg-black px-4 text-sm font-semibold text-white outline-none transition focus:border-emerald-400"
              >
                {GEO_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                Time range
              </span>
              <select
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-12 w-full rounded-2xl border border-zinc-800 bg-black px-4 text-sm font-semibold text-white outline-none transition focus:border-emerald-400"
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {isReady && (
          <div className="grid gap-6 xl:grid-cols-2">
            <WidgetCard
              title="Interest over time"
              type="TIMESERIES"
              query={query}
              geo={geo}
              time={time}
              height={430}
              retryKey={retryKey}
            />

            <WidgetCard
              title="Interest by region"
              type="GEO_MAP"
              query={query}
              geo={geo}
              time={time}
              height={430}
              retryKey={retryKey}
            />

            <WidgetCard
              title="Related queries"
              type="RELATED_QUERIES"
              query={query}
              geo={geo}
              time={time}
              height={540}
              retryKey={retryKey}
            />

            <WidgetCard
              title="Related topics"
              type="RELATED_TOPICS"
              query={query}
              geo={geo}
              time={time}
              height={540}
              retryKey={retryKey}
            />
          </div>
        )}
      </section>
    </main>
  );
}
