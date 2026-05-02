"use client";

import { useState } from "react";

const periodOptions = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 28 Days", value: "28d" },
];

export default function ManualImportPage() {
  const [period, setPeriod] = useState("28d");
  const [rawData, setRawData] = useState("");

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">Manual Import</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Open Spotify for Artists in your browser, copy the songs table, and paste it here.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="rounded-2xl border border-zinc-800 bg-black p-5">
            <h2 className="text-lg font-semibold text-white">Steps</h2>

            <div className="mt-4 space-y-2 text-sm text-zinc-300">
              <p>
                Open <span className="font-semibold text-white">Spotify for Artists</span>
              </p>
              <p>
                Go to <span className="font-semibold text-white">Music → Songs</span>
              </p>
              <p>
                Select time period:{" "}
                <span className="font-semibold text-white">24 hours</span> or{" "}
                <span className="font-semibold text-white">28 days</span>
              </p>
              <p>
                Select all rows in the table{" "}
                <span className="text-zinc-400">(Cmd+A / Ctrl+A)</span>
              </p>
              <p>
                Copy <span className="text-zinc-400">(Cmd+C / Ctrl+C)</span>
              </p>
              <p>
                Paste below, then click{" "}
                <span className="font-semibold text-white">Import</span>
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Time Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-11 w-full max-w-[220px] rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-green-500"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              S4A Table Data
            </label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder="Paste S4A table data here (Title | Streams | Listeners | Saves)..."
              className="min-h-[260px] w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-green-600 px-5 text-sm font-semibold text-white transition hover:bg-green-500">
              Import S4A Data
            </button>

            <button
              onClick={() => setRawData("")}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}