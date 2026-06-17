"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

const STORAGE_KEY = "spotify-growth-hub:mashups:v1";

const TABLE_NAME_MAP: Record<string, string> = {
  "TCC - Spotify Shared - Prod Stems": "Stems",
  "TCC - Spotify Shared - Prod Remakes": "Remakes",
  "TCC - Spotify Shared - Prod Vocals": "Vocals",
  "Production Stems": "Stems",
  "Production Remakes": "Remakes",
  "Production Vocals": "Vocals",
  Stems: "Stems",
  Remakes: "Remakes",
  Vocals: "Vocals",
};

type SmartSegmentRow = {
  id: number;
  table_name: string;
  sort_order: number;
  song: string;
  key_signature: string;
  chords: string;
  tempo: string;
  genre: string;
  row_color?: string;
  afropop?: boolean;
  soft_pop?: boolean;
  hyper_pop?: boolean;
  garage?: boolean;
  chill_house?: boolean;
  techno?: boolean;
  reggae?: boolean;
  afro_house?: boolean;
};

type SmartSegmentTable = {
  name: string;
  rows: SmartSegmentRow[];
};

type MashupSource = "vocals" | "production";

type SelectableTrack = {
  uid: string;
  source: MashupSource;
  sourceLabel: string;
  id: number;
  tableName: string;
  song: string;
  chords: string;
  keySignature: string;
};

type CreatedMashup = {
  id: string;
  first: SelectableTrack;
  second: SelectableTrack;
  done: boolean;
  createdAt: string;
};

function normalizeTableName(name: string): string {
  const cleanedName = String(name || "").trim();
  return TABLE_NAME_MAP[cleanedName] || cleanedName;
}

function normalizeText(value: string): string {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : "-";
}

function normalizeRow(row: SmartSegmentRow): SmartSegmentRow {
  return {
    ...row,
    table_name: normalizeTableName(row.table_name),
    song: normalizeText(row.song),
    chords: normalizeText(row.chords),
    key_signature: normalizeText(row.key_signature),
  };
}

function buildTrack(row: SmartSegmentRow, source: MashupSource): SelectableTrack {
  const tableName = normalizeTableName(row.table_name);

  return {
    uid: `${source}:${tableName}:${row.id}`,
    source,
    sourceLabel: source === "vocals" ? "Vocals" : tableName,
    id: row.id,
    tableName,
    song: normalizeText(row.song),
    chords: normalizeText(row.chords),
    keySignature: normalizeText(row.key_signature),
  };
}

function getTrackSummary(track: SelectableTrack) {
  const pieces = [track.keySignature, track.chords].filter(
    (piece) => piece && piece !== "-",
  );
  return pieces.length ? pieces.join(" · ") : "No chords";
}

function formatMashupChords(first: SelectableTrack, second: SelectableTrack) {
  return `${getTrackSummary(first)} × ${getTrackSummary(second)}`;
}

function createMashupId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function MashupsPage() {
  const [tables, setTables] = useState<SmartSegmentTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchVocals, setSearchVocals] = useState("");
  const [searchProduction, setSearchProduction] = useState("");
  const [selectedChords, setSelectedChords] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<SelectableTrack[]>([]);
  const [mashups, setMashups] = useState<CreatedMashup[]>([]);

  const loadProductionTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Failed to load production tracks.");
      }

      const data = (await response.json()) as SmartSegmentTable[];
      setTables(
        data.map((table) => ({
          name: normalizeTableName(table.name),
          rows: table.rows.map(normalizeRow),
        })),
      );
    } catch {
      setError("Failed to load mashup source tracks.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProductionTables();
  }, [loadProductionTables]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMashups(JSON.parse(saved) as CreatedMashup[]);
      }
    } catch {
      // Ignore broken local saved data.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mashups));
    } catch {
      // Ignore storage errors.
    }
  }, [mashups]);

  const vocalsTracks = useMemo(() => {
    return tables
      .filter((table) => normalizeTableName(table.name) === "Vocals")
      .flatMap((table) => table.rows.map((row) => buildTrack(row, "vocals")))
      .sort((a, b) => a.song.localeCompare(b.song, undefined, { sensitivity: "base" }));
  }, [tables]);

  const productionTracks = useMemo(() => {
    return tables
      .filter((table) => ["Stems", "Remakes"].includes(normalizeTableName(table.name)))
      .flatMap((table) => table.rows.map((row) => buildTrack(row, "production")))
      .sort(
        (a, b) =>
          a.tableName.localeCompare(b.tableName, undefined, { sensitivity: "base" }) ||
          a.song.localeCompare(b.song, undefined, { sensitivity: "base" }),
      );
  }, [tables]);

  const chordOptions = useMemo(() => {
    const chordSet = new Set<string>();

    [...vocalsTracks, ...productionTracks].forEach((track) => {
      const chord = normalizeText(track.chords);
      if (chord && chord !== "-") {
        chordSet.add(chord);
      }
    });

    return Array.from(chordSet).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [productionTracks, vocalsTracks]);

  const chordFilteredVocalsTracks = useMemo(() => {
    if (selectedChords.length === 0) return vocalsTracks;
    const selected = new Set(selectedChords);
    return vocalsTracks.filter((track) => selected.has(normalizeText(track.chords)));
  }, [selectedChords, vocalsTracks]);

  const chordFilteredProductionTracks = useMemo(() => {
    if (selectedChords.length === 0) return productionTracks;
    const selected = new Set(selectedChords);
    return productionTracks.filter((track) => selected.has(normalizeText(track.chords)));
  }, [productionTracks, selectedChords]);

  const filteredVocalsTracks = useMemo(() => {
    const query = searchVocals.trim().toLowerCase();
    if (!query) return chordFilteredVocalsTracks;
    return chordFilteredVocalsTracks.filter((track) =>
      [track.song, track.chords, track.keySignature, track.tableName]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [chordFilteredVocalsTracks, searchVocals]);

  const filteredProductionTracks = useMemo(() => {
    const query = searchProduction.trim().toLowerCase();
    if (!query) return chordFilteredProductionTracks;
    return chordFilteredProductionTracks.filter((track) =>
      [track.song, track.chords, track.keySignature, track.tableName]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [chordFilteredProductionTracks, searchProduction]);

  const toggleChordFilter = useCallback((chord: string) => {
    setSelectedChords((current) =>
      current.includes(chord)
        ? current.filter((item) => item !== chord)
        : [...current, chord],
    );
  }, []);

  const toggleAllChordFilters = useCallback(() => {
    setSelectedChords((current) =>
      current.length === chordOptions.length ? [] : [...chordOptions],
    );
  }, [chordOptions]);

  const clearChordFilters = useCallback(() => {
    setSelectedChords([]);
  }, []);

  const selectedTrackMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedTracks.forEach((track, index) => map.set(track.uid, index + 1));
    return map;
  }, [selectedTracks]);

  const canCreateMashups = selectedTracks.length > 0 && selectedTracks.length % 2 === 0;

  const toggleTrack = useCallback((track: SelectableTrack) => {
    setSelectedTracks((current) => {
      const existingIndex = current.findIndex((item) => item.uid === track.uid);
      if (existingIndex >= 0) {
        return current.filter((item) => item.uid !== track.uid);
      }
      return [...current, track];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTracks([]);
  }, []);

  const handleCreateMashups = useCallback(() => {
    if (!canCreateMashups) return;

    const newMashups: CreatedMashup[] = [];
    for (let index = 0; index < selectedTracks.length; index += 2) {
      const first = selectedTracks[index];
      const second = selectedTracks[index + 1];
      if (!first || !second) continue;

      newMashups.push({
        id: createMashupId(),
        first,
        second,
        done: false,
        createdAt: new Date().toISOString(),
      });
    }

    setMashups((current) => [...newMashups, ...current]);
    setSelectedTracks([]);
  }, [canCreateMashups, selectedTracks]);

  const toggleMashupDone = useCallback((id: string) => {
    setMashups((current) =>
      current.map((mashup) =>
        mashup.id === id ? { ...mashup, done: !mashup.done } : mashup,
      ),
    );
  }, []);

  const deleteMashup = useCallback((id: string) => {
    setMashups((current) => current.filter((mashup) => mashup.id !== id));
  }, []);


  const ChordFilterDropdown = ({
    className = "",
  }: {
    className?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");

    const filteredChordOptions = useMemo(() => {
      const searchValue = query.trim().toLowerCase();
      if (!searchValue) return chordOptions;
      return chordOptions.filter((chord) =>
        chord.toLowerCase().includes(searchValue),
      );
    }, [query]);

    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-12 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-left text-sm font-semibold text-white outline-none hover:border-green-500"
        >
          <span className={selectedChords.length > 0 ? "text-white" : "text-zinc-500"}>
            {selectedChords.length > 0
              ? `${selectedChords.length} Cord${selectedChords.length === 1 ? "" : "s"} Selected`
              : "Cord Filter"}
          </span>
          <span className="text-green-500">▾</span>
        </button>

        {isOpen ? (
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full rounded-xl border border-zinc-800 bg-black p-3 shadow-2xl shadow-black/60">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <input
                type="checkbox"
                checked={
                  chordOptions.length > 0 &&
                  selectedChords.length === chordOptions.length
                }
                onChange={toggleAllChordFilters}
                className="h-4 w-4 rounded border-zinc-700 accent-green-500"
              />
              Select All
            </label>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="mb-3 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
            />

            <div className="max-h-[280px] space-y-1 overflow-auto pr-1">
              {filteredChordOptions.map((chord) => (
                <label
                  key={chord}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm font-semibold text-white hover:bg-zinc-900"
                >
                  <input
                    type="checkbox"
                    checked={selectedChords.includes(chord)}
                    onChange={() => toggleChordFilter(chord)}
                    className="h-4 w-4 rounded border-zinc-700 accent-green-500"
                  />
                  {chord}
                </label>
              ))}

              {filteredChordOptions.length === 0 ? (
                <div className="py-4 text-center text-sm text-zinc-500">
                  No chords found.
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-zinc-900 pt-3 text-xs text-zinc-500">
              <button
                type="button"
                onClick={clearChordFilters}
                disabled={selectedChords.length === 0}
                className="rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 font-semibold text-red-300 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Selected
              </button>
              <span>{selectedChords.length} selected</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const TrackListCard = ({
    title,
    subtitle,
    tracks,
  }: {
    title: string;
    subtitle: string;
    tracks: SelectableTrack[];
  }) => (
    <section className="min-h-[620px] rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/20">
      <div className="border-b border-zinc-800/80 p-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      </div>

      <div className="max-h-[680px] overflow-auto">
        <table className="w-full min-w-[0px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-950">
            <tr className="border-b border-zinc-800/80 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <th className="w-[48px] px-3 py-3">#</th>
              <th className="px-3 py-3">Name</th>
              <th className="w-[120px] px-3 py-3">Chords</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => {
              const order = selectedTrackMap.get(track.uid);
              const isSelected = Boolean(order);

              return (
                <tr
                  key={track.uid}
                  onClick={() => toggleTrack(track)}
                  className={`cursor-pointer border-b border-zinc-900 transition hover:bg-zinc-900/70 ${
                    isSelected ? "bg-green-950/20 text-green-200" : "text-zinc-200"
                  }`}
                >
                  <td className="px-3 py-3 align-middle">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                        isSelected
                          ? "border-green-500 bg-green-500 text-black"
                          : "border-zinc-700 text-zinc-600"
                      }`}
                    >
                      {order || ""}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="font-semibold text-white">{track.song}</div>
                    <div className="mt-1 text-xs text-zinc-500">{track.sourceLabel}</div>
                  </td>
                  <td className="px-3 py-3 align-middle text-zinc-300">
                    <div>{track.chords}</div>
                    <div className="mt-1 text-xs text-zinc-500">{track.keySignature}</div>
                  </td>
                </tr>
              );
            })}

            {tracks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No tracks found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white lg:px-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Mashups</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Select tracks in order. Every even pair becomes a mashup: 1 x 2, 3 x 4, and so on.
        </p>
      </div>

      {selectedTracks.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">Selected:</span>
            {selectedTracks.map((track, index) => (
              <span
                key={track.uid}
                className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-300"
              >
                <span className="mr-1 font-bold text-green-400">{index + 1}</span>
                {track.song}
              </span>
            ))}

            <button
              onClick={clearSelection}
              className="ml-auto h-9 rounded-xl border border-zinc-800 bg-black px-4 text-xs font-semibold text-zinc-300 hover:border-zinc-600"
            >
              Clear
            </button>
          </div>

          {selectedTracks.length % 2 !== 0 ? (
            <p className="mt-3 text-xs text-yellow-300">
              Select one more track to make the selection even before creating mashups.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-500/80 bg-red-950/20 p-5 text-sm font-semibold text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-400">
          Loading mashup source tracks...
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div
            className="grid gap-5"
            style={{
              minWidth: "1180px",
              maxWidth: "1500px",
              gridTemplateColumns: "minmax(260px, 0.82fr) minmax(220px, 0.68fr) minmax(430px, 1.45fr)",
            }}
          >
            <div
              className="flex h-12 items-center gap-3"
              style={{ gridColumn: "1 / span 2" }}
            >
<ChordFilterDropdown className="min-w-0 flex-1" />
              <button
                onClick={handleCreateMashups}
                disabled={!canCreateMashups}
                className="h-12 shrink-0 rounded-xl bg-green-500 px-5 text-sm font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Create
              </button>
            </div>

<ChordFilterDropdown />

            <TrackListCard
              title="Vocals"
              subtitle={`${vocalsTracks.length} vocal entries from Production Vocals`}
              tracks={filteredVocalsTracks}
            />

            <TrackListCard
              title="Stems & Remakes"
              subtitle={`${productionTracks.length} entries from Production Stems and Production Remakes`}
              tracks={filteredProductionTracks}
            />

            <section className="min-h-[620px] rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/20">
              <div className="border-b border-zinc-800/80 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Mashups</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Created pairs stay here. Use the check icon to mark as done.
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-400">
                    {mashups.length} total
                  </span>
                </div>
              </div>

              <div className="divide-y divide-zinc-900">
                {mashups.map((mashup) => (
                  <article
                    key={mashup.id}
                    className={`flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between ${
                      mashup.done ? "bg-green-950/10" : ""
                    }`}
                  >
                    <div>
                      <h3
                        className={`text-base font-bold ${
                          mashup.done
                            ? "text-green-300 line-through decoration-green-500/70"
                            : "text-white"
                        }`}
                      >
                        {mashup.first.song} <span className="text-zinc-500">x</span>{" "}
                        {mashup.second.song}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        {formatMashupChords(mashup.first, mashup.second)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {mashup.first.sourceLabel} x {mashup.second.sourceLabel}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleMashupDone(mashup.id)}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition ${
                          mashup.done
                            ? "border-green-500 bg-green-500 text-black"
                            : "border-zinc-800 bg-black text-zinc-300 hover:border-green-500 hover:text-green-400"
                        }`}
                        title={mashup.done ? "Mark as not done" : "Mark as done"}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => deleteMashup(mashup.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-black text-zinc-300 transition hover:border-red-500 hover:text-red-300"
                        title="Delete mashup"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6l1 16h10l1-16" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </article>
                ))}

                {mashups.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No mashups created yet. Select an even number of tracks and press Create.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
