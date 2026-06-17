"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

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
  id: number;
  first: SelectableTrack;
  second: SelectableTrack;
  done: boolean;
  createdAt: string;
};

type MashupApiRow = {
  id: number;
  sort_order: number;
  first_track_id: number | null;
  first_source: string;
  first_source_label: string;
  first_table_name: string;
  first_song: string;
  first_chords: string;
  first_key_signature: string;
  second_track_id: number | null;
  second_source: string;
  second_source_label: string;
  second_table_name: string;
  second_song: string;
  second_chords: string;
  second_key_signature: string;
  done: boolean;
  created_at: string;
};

type UndoAction =
  | {
      type: "createMashups";
      label: string;
      mashups: CreatedMashup[];
    }
  | {
      type: "deleteMashup";
      label: string;
      mashup: CreatedMashup;
    }
  | {
      type: "toggleDone";
      label: string;
      mashup: CreatedMashup;
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

function apiRowToMashup(row: MashupApiRow): CreatedMashup {
  const firstId = row.first_track_id || 0;
  const secondId = row.second_track_id || 0;
  const firstSource = (row.first_source || "vocals") as MashupSource;
  const secondSource = (row.second_source || "production") as MashupSource;

  return {
    id: row.id,
    first: {
      uid: `${firstSource}:${row.first_table_name}:${firstId}`,
      source: firstSource,
      sourceLabel: row.first_source_label || row.first_table_name || "Vocals",
      id: firstId,
      tableName: normalizeTableName(row.first_table_name),
      song: normalizeText(row.first_song),
      chords: normalizeText(row.first_chords),
      keySignature: normalizeText(row.first_key_signature),
    },
    second: {
      uid: `${secondSource}:${row.second_table_name}:${secondId}`,
      source: secondSource,
      sourceLabel: row.second_source_label || row.second_table_name || "Production",
      id: secondId,
      tableName: normalizeTableName(row.second_table_name),
      song: normalizeText(row.second_song),
      chords: normalizeText(row.second_chords),
      keySignature: normalizeText(row.second_key_signature),
    },
    done: Boolean(row.done),
    createdAt: row.created_at || "",
  };
}

function mashupToCreatePayload(mashup: Omit<CreatedMashup, "id">) {
  return {
    first: {
      id: mashup.first.id,
      source: mashup.first.source,
      sourceLabel: mashup.first.sourceLabel,
      tableName: mashup.first.tableName,
      song: mashup.first.song,
      chords: mashup.first.chords,
      keySignature: mashup.first.keySignature,
    },
    second: {
      id: mashup.second.id,
      source: mashup.second.source,
      sourceLabel: mashup.second.sourceLabel,
      tableName: mashup.second.tableName,
      song: mashup.second.song,
      chords: mashup.second.chords,
      keySignature: mashup.second.keySignature,
    },
    done: mashup.done,
    createdAt: mashup.createdAt,
  };
}

export default function MashupsPage() {
  const [tables, setTables] = useState<SmartSegmentTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMashups, setIsLoadingMashups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchVocals, setSearchVocals] = useState("");
  const [searchProduction, setSearchProduction] = useState("");
  const [selectedChords, setSelectedChords] = useState<string[]>([]);
  const [selectedMashupChords, setSelectedMashupChords] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<SelectableTrack[]>([]);
  const [mashups, setMashups] = useState<CreatedMashup[]>([]);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isCreatingMashups, setIsCreatingMashups] = useState(false);
  const [isDoneOpen, setIsDoneOpen] = useState(false);

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((current) => [...current.slice(-24), action]);
  }, []);

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

  const loadMashups = useCallback(async () => {
    setIsLoadingMashups(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/production/mashups`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load mashups.");
      }

      const data = (await response.json()) as MashupApiRow[];
      setMashups(data.map(apiRowToMashup));
    } catch {
      setError("Failed to load saved mashups.");
    } finally {
      setIsLoadingMashups(false);
    }
  }, []);

  useEffect(() => {
    loadProductionTables();
    loadMashups();
  }, [loadMashups, loadProductionTables]);

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

  const hasSourceChordFilter = selectedChords.length > 0;


  const filteredVocalsTracks = useMemo(() => {
    if (!hasSourceChordFilter) return [];
    const query = searchVocals.trim().toLowerCase();
    if (!query) return chordFilteredVocalsTracks;
    return chordFilteredVocalsTracks.filter((track) =>
      [track.song, track.chords, track.keySignature, track.tableName]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [chordFilteredVocalsTracks, hasSourceChordFilter, searchVocals]);

  const filteredProductionTracks = useMemo(() => {
    if (!hasSourceChordFilter) return [];
    const query = searchProduction.trim().toLowerCase();
    if (!query) return chordFilteredProductionTracks;
    return chordFilteredProductionTracks.filter((track) =>
      [track.song, track.chords, track.keySignature, track.tableName]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [chordFilteredProductionTracks, hasSourceChordFilter, searchProduction]);

  const activeMashups = useMemo(
    () => mashups.filter((mashup) => !mashup.done),
    [mashups],
  );

  const doneMashups = useMemo(
    () => mashups.filter((mashup) => mashup.done),
    [mashups],
  );

  const mashupChordOptions = useMemo(() => {
    const chordSet = new Set<string>();

    mashups.forEach((mashup) => {
      [mashup.first.chords, mashup.second.chords].forEach((chordValue) => {
        const chord = normalizeText(chordValue);
        if (chord && chord !== "-") {
          chordSet.add(chord);
        }
      });
    });

    return Array.from(chordSet).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [mashups]);

  const filteredActiveMashups = useMemo(() => {
    if (selectedMashupChords.length === 0) return activeMashups;
    const selected = new Set(selectedMashupChords);
    return activeMashups.filter(
      (mashup) =>
        selected.has(normalizeText(mashup.first.chords)) ||
        selected.has(normalizeText(mashup.second.chords)),
    );
  }, [activeMashups, selectedMashupChords]);

  const filteredDoneMashups = useMemo(() => {
    if (selectedMashupChords.length === 0) return doneMashups;
    const selected = new Set(selectedMashupChords);
    return doneMashups.filter(
      (mashup) =>
        selected.has(normalizeText(mashup.first.chords)) ||
        selected.has(normalizeText(mashup.second.chords)),
    );
  }, [doneMashups, selectedMashupChords]);

  const selectedTrackMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedTracks.forEach((track, index) => map.set(track.uid, index + 1));
    return map;
  }, [selectedTracks]);

  const canCreateMashups =
    selectedTracks.length > 0 &&
    selectedTracks.length % 2 === 0 &&
    !isCreatingMashups;

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

  const toggleMashupChordFilter = useCallback((chord: string) => {
    setSelectedMashupChords((current) =>
      current.includes(chord)
        ? current.filter((item) => item !== chord)
        : [...current, chord],
    );
  }, []);

  const toggleAllMashupChordFilters = useCallback(() => {
    setSelectedMashupChords((current) =>
      current.length === mashupChordOptions.length ? [] : [...mashupChordOptions],
    );
  }, [mashupChordOptions]);

  const clearMashupChordFilters = useCallback(() => {
    setSelectedMashupChords([]);
  }, []);

  const handleCreateMashups = useCallback(async () => {
    if (!canCreateMashups) return;

    setIsCreatingMashups(true);
    setError(null);

    const newMashupDrafts: Array<Omit<CreatedMashup, "id">> = [];
    for (let index = 0; index < selectedTracks.length; index += 2) {
      const first = selectedTracks[index];
      const second = selectedTracks[index + 1];
      if (!first || !second) continue;

      newMashupDrafts.push({
        first,
        second,
        done: false,
        createdAt: new Date().toISOString(),
      });
    }

    try {
      const createdMashups = await Promise.all(
        newMashupDrafts.map(async (draft) => {
          const response = await fetch(`${API_BASE_URL}/api/production/mashups`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mashupToCreatePayload(draft)),
          });

          if (!response.ok) {
            throw new Error("Failed to create mashup.");
          }

          return apiRowToMashup((await response.json()) as MashupApiRow);
        }),
      );

      setMashups((current) => [...createdMashups, ...current]);
      pushUndo({
        type: "createMashups",
        label: "Undo create",
        mashups: createdMashups,
      });
      setSelectedTracks([]);
    } catch {
      setError("Failed to create mashups.");
    } finally {
      setIsCreatingMashups(false);
    }
  }, [canCreateMashups, pushUndo, selectedTracks]);

  const toggleMashupDone = useCallback(
    async (mashup: CreatedMashup) => {
      const nextDone = !mashup.done;
      const previousMashup = { ...mashup };

      setMashups((current) =>
        current.map((item) =>
          item.id === mashup.id ? { ...item, done: nextDone } : item,
        ),
      );

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/production/mashups/${mashup.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: nextDone }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update mashup.");
        }

        const savedMashup = apiRowToMashup((await response.json()) as MashupApiRow);
        setMashups((current) =>
          current.map((item) => (item.id === mashup.id ? savedMashup : item)),
        );

        pushUndo({
          type: "toggleDone",
          label: nextDone ? "Undo done" : "Undo not done",
          mashup: previousMashup,
        });
      } catch {
        setMashups((current) =>
          current.map((item) => (item.id === mashup.id ? previousMashup : item)),
        );
        setError("Failed to update mashup.");
      }
    },
    [pushUndo],
  );

  const deleteMashup = useCallback(
    async (mashup: CreatedMashup) => {
      setMashups((current) => current.filter((item) => item.id !== mashup.id));

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/production/mashups/${mashup.id}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          throw new Error("Failed to delete mashup.");
        }

        pushUndo({
          type: "deleteMashup",
          label: "Undo delete",
          mashup,
        });
      } catch {
        setMashups((current) => [mashup, ...current]);
        setError("Failed to delete mashup.");
      }
    },
    [pushUndo],
  );

  const restoreDeletedMashup = useCallback(async (mashup: CreatedMashup) => {
    const response = await fetch(`${API_BASE_URL}/api/production/mashups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mashupToCreatePayload(mashup)),
    });

    if (!response.ok) {
      throw new Error("Failed to restore mashup.");
    }

    return apiRowToMashup((await response.json()) as MashupApiRow);
  }, []);

  const handleUndo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action || isUndoing) return;

    setIsUndoing(true);
    setError(null);

    try {
      if (action.type === "createMashups") {
        await Promise.all(
          action.mashups.map((mashup) =>
            fetch(`${API_BASE_URL}/api/production/mashups/${mashup.id}`, {
              method: "DELETE",
            }),
          ),
        );

        const createdIds = new Set(action.mashups.map((mashup) => mashup.id));
        setMashups((current) => current.filter((mashup) => !createdIds.has(mashup.id)));
      }

      if (action.type === "deleteMashup") {
        const restored = await restoreDeletedMashup(action.mashup);
        setMashups((current) => [restored, ...current]);
      }

      if (action.type === "toggleDone") {
        const response = await fetch(
          `${API_BASE_URL}/api/production/mashups/${action.mashup.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: action.mashup.done }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to undo done state.");
        }

        const restored = apiRowToMashup((await response.json()) as MashupApiRow);
        setMashups((current) =>
          current.map((mashup) => (mashup.id === restored.id ? restored : mashup)),
        );
      }

      setUndoStack((current) => current.slice(0, -1));
    } catch {
      setError("Failed to undo the last action.");
    } finally {
      setIsUndoing(false);
    }
  }, [isUndoing, restoreDeletedMashup, undoStack]);

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

  const ChordFilterDropdown = ({
    className = "",
    options = chordOptions,
    selected = selectedChords,
    onToggle = toggleChordFilter,
    onToggleAll = toggleAllChordFilters,
    onClear = clearChordFilters,
    emptyText = "No chords found.",
  }: {
    className?: string;
    options?: string[];
    selected?: string[];
    onToggle?: (chord: string) => void;
    onToggleAll?: () => void;
    onClear?: () => void;
    emptyText?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");

    const filteredChordOptions = useMemo(() => {
      const searchValue = query.trim().toLowerCase();
      if (!searchValue) return options;
      return options.filter((chord) =>
        chord.toLowerCase().includes(searchValue),
      );
    }, [options, query]);

    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-left text-sm font-semibold text-white outline-none hover:border-green-500"
        >
          <span className={selected.length > 0 ? "text-white" : "text-zinc-500"}>
            {selected.length > 0
              ? `${selected.length} Cord${selected.length === 1 ? "" : "s"} Selected`
              : "Cord Filter"}
          </span>
          <span className="text-green-500">▾</span>
        </button>

        {isOpen ? (
          <div
            className="absolute left-0 top-[calc(100%+8px)] z-50 flex h-[405px] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-2xl shadow-black/60"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 p-3 pb-2">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <input
                  type="checkbox"
                  checked={options.length > 0 && selected.length === options.length}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-zinc-700 accent-green-500"
                />
                Select All
              </label>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
              />
            </div>

            <div className="mx-3 min-h-0 flex-1 rounded-lg border border-zinc-900 bg-black">
              <div className="h-full space-y-1 overflow-y-auto p-2 pr-1 [scrollbar-color:#10b981_#020617] [scrollbar-width:thin]">
                {filteredChordOptions.map((chord) => (
                  <label
                    key={chord}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm font-semibold text-white hover:bg-zinc-900"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(chord)}
                      onChange={(event) => {
                        event.stopPropagation();
                        onToggle(chord);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="h-4 w-4 rounded border-zinc-700 accent-green-500"
                    />
                    {chord}
                  </label>
                ))}

                {filteredChordOptions.length === 0 ? (
                  <div className="py-4 text-center text-sm text-zinc-500">
                    {emptyText}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex shrink-0 items-center gap-3 border-t border-zinc-800 bg-zinc-950/70 p-2">
              <button
                type="button"
                onClick={onClear}
                disabled={selected.length === 0}
                className="h-9 rounded-lg border border-red-900/70 bg-red-950/30 px-3 text-xs font-semibold text-red-300 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Selected
              </button>

              <span className="ml-auto text-xs text-zinc-500">
                {selected.length} selected
              </span>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-black hover:bg-green-500"
                title="Apply filter"
              >
                ➜
              </button>
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
    <section className="h-[calc(100vh-245px)] min-h-[420px] rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/20">
      <div className="border-b border-zinc-800/80 p-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      </div>

      <div className="h-[calc(100%-82px)] overflow-auto">
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
                  Select a chord filter to view tracks.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const MashupItem = ({ mashup }: { mashup: CreatedMashup }) => (
    <article
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
          onClick={() => toggleMashupDone(mashup)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition ${
            mashup.done
              ? "border-green-500 bg-green-500 text-black"
              : "border-zinc-800 bg-black text-zinc-300 hover:border-green-500 hover:text-green-400"
          }`}
          title={mashup.done ? "Move back to Mashups" : "Mark as done"}
        >
          ✓
        </button>
        <button
          onClick={() => deleteMashup(mashup)}
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
  );

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white lg:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Mashups</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Select tracks in order. Every even pair becomes a mashup: 1 x 2, 3 x 4, and so on.
          </p>
        </div>

        {undoStack.length > 0 ? (
          <button
            onClick={handleUndo}
            disabled={isUndoing}
            className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-semibold text-zinc-200 hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            title="Undo, or press Ctrl+Z"
          >
            {isUndoing ? "Undoing..." : "Undo"}
          </button>
        ) : null}
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
        <div className="pb-4">
          <div
            className="grid gap-5"
            style={{
              width: "100%",
              gridTemplateColumns:
                "minmax(240px, 0.8fr) minmax(220px, 0.7fr) minmax(360px, 1.2fr)",
            }}
          >
            <div
              className="flex h-11 items-center gap-3"
              style={{ gridColumn: "1 / span 2" }}
            >
              <ChordFilterDropdown className="min-w-0 flex-1 max-w-[520px]" />
              <button
                onClick={handleCreateMashups}
                disabled={!canCreateMashups}
                className="h-11 shrink-0 rounded-xl bg-green-500 px-5 text-sm font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {isCreatingMashups ? "Creating..." : "Create"}
              </button>
            </div>

            <ChordFilterDropdown
              options={mashupChordOptions}
              selected={selectedMashupChords}
              onToggle={toggleMashupChordFilter}
              onToggleAll={toggleAllMashupChordFilters}
              onClear={clearMashupChordFilters}
              emptyText="No mashup chords yet."
            />

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

            <section className="h-[calc(100vh-245px)] min-h-[420px] rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/20">
              <div className="border-b border-zinc-800/80 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Mashups</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Created pairs are saved to the database.
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-400">
                    {isLoadingMashups ? "Loading..." : `${filteredActiveMashups.length} active`}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-zinc-900">
                {filteredActiveMashups.map((mashup) => (
                  <MashupItem key={mashup.id} mashup={mashup} />
                ))}

                {filteredActiveMashups.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No active mashups. Select an even number of tracks and press Create.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <section className="mt-5 w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/20">
            <button
              onClick={() => setIsDoneOpen((current) => !current)}
              className="flex w-full items-center justify-between p-5 text-left"
            >
              <div>
                <h2 className="text-lg font-bold text-white">Created</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Created mashups marked with the tick move here.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-400">
                  {filteredDoneMashups.length} created
                </span>
                <span className="text-green-500">{isDoneOpen ? "▴" : "▾"}</span>
              </div>
            </button>

            {isDoneOpen ? (
              <div className="divide-y divide-zinc-900 border-t border-zinc-800/80">
                {filteredDoneMashups.map((mashup) => (
                  <MashupItem key={mashup.id} mashup={mashup} />
                ))}

                {filteredDoneMashups.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No created mashups marked done yet.
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
