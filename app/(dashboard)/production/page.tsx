"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

const TABLE_NAMES = ["Stems", "Remakes", "Vocals"] as const;

const TABLE_NAME_MAP: Record<string, TableName> = {
  "TCC - Spotify Shared - Prod Stems": "Stems",
  "TCC - Spotify Shared - Prod Remakes": "Remakes",
  "TCC - Spotify Shared - Prod Vocals": "Vocals",
  "Production Stems": "Stems",
  "Production Remakes": "Remakes",
  "Production Vocals": "Vocals",
  "Stems": "Stems",
  "Remakes": "Remakes",
  "Vocals": "Vocals",
};

const SEGMENT_COLUMNS = [
  { key: "afropop", label: "Afropop" },
  { key: "soft_pop", label: "Soft Pop" },
  { key: "hyper_pop", label: "Hyper Pop" },
  { key: "garage", label: "Garage" },
  { key: "chill_house", label: "Chill House" },
  { key: "techno", label: "Techno" },
  { key: "reggae", label: "Reggae" },
  { key: "afro_house", label: "Afro House" },
] as const;

const TEXT_COLUMNS = [
  { key: "song", label: "Song", width: "w-[220px]" },
  { key: "key_signature", label: "Key", width: "w-[100px]" },
  { key: "chords", label: "Chords", width: "w-[150px]" },
  { key: "tempo", label: "Tempo", width: "w-[80px]" },
  { key: "genre", label: "Genre", width: "w-[130px]" },
] as const;

const GENRE_OPTIONS = [
  "-",
  "Afro House",
  "Afropop",
  "Chill House",
  "EDM",
  "Garage",
  "House",
  "Hyper Pop",
  "Hyper Techno",
  "Pop",
  "Reggae",
  "Soft Pop",
  "Tech House",
  "Techno",
] as const;

type TableName = (typeof TABLE_NAMES)[number];
type SegmentKey = (typeof SEGMENT_COLUMNS)[number]["key"];
type TextKey = (typeof TEXT_COLUMNS)[number]["key"];
type SortKey = TextKey | SegmentKey;
type SortDirection = "asc" | "desc";

type SmartSegmentRow = {
  id: number;
  table_name: string;
  sort_order: number;
  song: string;
  key_signature: string;
  chords: string;
  tempo: string;
  genre: string;
  afropop: boolean;
  soft_pop: boolean;
  hyper_pop: boolean;
  garage: boolean;
  chill_house: boolean;
  techno: boolean;
  reggae: boolean;
  afro_house: boolean;
};

type SmartSegmentTable = {
  name: string;
  rows: SmartSegmentRow[];
};

type RowPatch = Partial<
  Pick<
    SmartSegmentRow,
    | "song"
    | "key_signature"
    | "chords"
    | "tempo"
    | "genre"
    | "afropop"
    | "soft_pop"
    | "hyper_pop"
    | "garage"
    | "chill_house"
    | "techno"
    | "reggae"
    | "afro_house"
  >
>;

type DraftRow = RowPatch;

type SaveStatus = "idle" | "saving" | "saved" | "error";

const EMPTY_DRAFT_ROW: Required<DraftRow> = {
  song: "",
  key_signature: "",
  chords: "",
  tempo: "",
  genre: "",
  afropop: false,
  soft_pop: false,
  hyper_pop: false,
  garage: false,
  chill_house: false,
  techno: false,
  reggae: false,
  afro_house: false,
};

function normalizeTableName(name: string): TableName {
  return TABLE_NAME_MAP[name] || "Stems";
}

function normalizeTextValue(value: string, allowEmpty = false) {
  const cleaned = value.trim();
  if (cleaned.length > 0) return cleaned;
  return allowEmpty ? "" : "-";
}

function getComparableValue(row: SmartSegmentRow, key: SortKey) {
  const value = row[key];

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return String(value || "").toLowerCase();
}

function sortRows(rows: SmartSegmentRow[], key: SortKey | null, direction: SortDirection) {
  if (!key) {
    return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }

  return [...rows].sort((a, b) => {
    const first = getComparableValue(a, key);
    const second = getComparableValue(b, key);

    const result = first.localeCompare(second, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    return direction === "asc" ? result : -result;
  });
}

function createEmptyDraftRow(): Required<DraftRow> {
  return { ...EMPTY_DRAFT_ROW };
}

export default function ProductionPage() {
  const [tables, setTables] = useState<SmartSegmentTable[]>([]);
  const [activeTableName, setActiveTableName] = useState<TableName>("Stems");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [lastSelectedRowId, setLastSelectedRowId] = useState<number | null>(null);
  const [saveStatusByRow, setSaveStatusByRow] = useState<Record<number, SaveStatus>>({});
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [draftRows, setDraftRows] = useState<Record<TableName, Required<DraftRow>>>({
    Stems: createEmptyDraftRow(),
    Remakes: createEmptyDraftRow(),
    Vocals: createEmptyDraftRow(),
  });
  const [isCreatingRow, setIsCreatingRow] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isDeletingRows, setIsDeletingRows] = useState(false);

  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const patchesRef = useRef<Record<number, RowPatch>>({});

  const loadTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/production/smart-segments`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load production tables.");
      }

      const data = (await response.json()) as SmartSegmentTable[];
      const normalizedData = data.map((table) => ({
        ...table,
        name: normalizeTableName(table.name),
        rows: table.rows.map((row) => ({
          ...row,
          table_name: normalizeTableName(row.table_name),
        })),
      }));

      const tablesByName = new Map<TableName, SmartSegmentTable>();
      normalizedData.forEach((table) => {
        const tableName = normalizeTableName(table.name);
        tablesByName.set(tableName, {
          name: tableName,
          rows: [...(tablesByName.get(tableName)?.rows || []), ...table.rows],
        });
      });

      setTables(
        TABLE_NAMES.map((tableName) => ({
          name: tableName,
          rows: tablesByName.get(tableName)?.rows || [],
        })),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load production tables.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();

    return () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, [loadTables]);

  const activeTable = useMemo(() => {
    return (
      tables.find((table) => table.name === activeTableName) || {
        name: activeTableName,
        rows: [],
      }
    );
  }, [activeTableName, tables]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filteredRows = !query
      ? activeTable.rows
      : activeTable.rows.filter((row) =>
          [row.song, row.key_signature, row.chords, row.tempo, row.genre]
            .join(" ")
            .toLowerCase()
            .includes(query),
        );

    return sortRows(filteredRows, sortKey, sortDirection);
  }, [activeTable.rows, search, sortDirection, sortKey]);

  const selectedVisibleCount = useMemo(() => {
    return visibleRows.filter((row) => selectedRowIds.has(row.id)).length;
  }, [selectedRowIds, visibleRows]);

  const activeSelectedCount = useMemo(() => {
    const activeRowIds = new Set(activeTable.rows.map((row) => row.id));
    return Array.from(selectedRowIds).filter((rowId) => activeRowIds.has(rowId)).length;
  }, [activeTable.rows, selectedRowIds]);

  const updateRowLocally = useCallback((rowId: number, patch: RowPatch) => {
    setTables((currentTables) =>
      currentTables.map((table) => ({
        ...table,
        rows: table.rows.map((row) =>
          row.id === rowId
            ? {
                ...row,
                ...patch,
              }
            : row,
        ),
      })),
    );
  }, []);

  const saveRow = useCallback(async (rowId: number) => {
    const patch = patchesRef.current[rowId];
    if (!patch) return;

    delete patchesRef.current[rowId];

    setSaveStatusByRow((current) => ({
      ...current,
      [rowId]: "saving",
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments/rows/${rowId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patch),
        },
      );

      if (!response.ok) {
        throw new Error("Autosave failed.");
      }

      const savedRow = (await response.json()) as SmartSegmentRow;
      setTables((currentTables) =>
        currentTables.map((table) => ({
          ...table,
          rows: table.rows.map((row) =>
            row.id === rowId
              ? {
                  ...savedRow,
                  table_name: normalizeTableName(savedRow.table_name),
                }
              : row,
          ),
        })),
      );

      setSaveStatusByRow((current) => ({
        ...current,
        [rowId]: "saved",
      }));
    } catch {
      setSaveStatusByRow((current) => ({
        ...current,
        [rowId]: "error",
      }));
    }
  }, [updateRowLocally]);

  const scheduleSave = useCallback(
    (rowId: number, patch: RowPatch) => {
      patchesRef.current[rowId] = {
        ...patchesRef.current[rowId],
        ...patch,
      };

      setSaveStatusByRow((current) => ({
        ...current,
        [rowId]: "idle",
      }));

      if (timersRef.current[rowId]) {
        clearTimeout(timersRef.current[rowId]);
      }

      timersRef.current[rowId] = setTimeout(() => {
        saveRow(rowId);
      }, 650);
    },
    [saveRow],
  );

  const handleTextChange = useCallback(
    (row: SmartSegmentRow, field: TextKey, value: string) => {
      const patch = { [field]: value } as RowPatch;
      updateRowLocally(row.id, patch);
      scheduleSave(row.id, patch);
    },
    [scheduleSave, updateRowLocally],
  );

  const handleTextBlur = useCallback(
    (row: SmartSegmentRow, field: TextKey, value: string) => {
      const finalValue = normalizeTextValue(value, field === "song");
      const patch = { [field]: finalValue } as RowPatch;
      updateRowLocally(row.id, patch);
      scheduleSave(row.id, patch);
    },
    [scheduleSave, updateRowLocally],
  );

  const handleSegmentChange = useCallback(
    (row: SmartSegmentRow, field: SegmentKey, value: boolean) => {
      const patch = { [field]: value } as RowPatch;
      updateRowLocally(row.id, patch);
      scheduleSave(row.id, patch);
    },
    [scheduleSave, updateRowLocally],
  );

  const handleDraftTextChange = useCallback(
    (field: TextKey, value: string) => {
      setCreateError(null);
      setDraftRows((current) => ({
        ...current,
        [activeTableName]: {
          ...current[activeTableName],
          [field]: value,
        },
      }));
    },
    [activeTableName],
  );

  const handleDraftSegmentChange = useCallback(
    (field: SegmentKey, value: boolean) => {
      setCreateError(null);
      setDraftRows((current) => ({
        ...current,
        [activeTableName]: {
          ...current[activeTableName],
          [field]: value,
        },
      }));
    },
    [activeTableName],
  );

  const handleCreateRow = useCallback(async () => {
    const draft = draftRows[activeTableName];
    const hasAnyValue =
      Boolean(draft.song.trim()) ||
      Boolean(draft.key_signature.trim()) ||
      Boolean(draft.chords.trim()) ||
      Boolean(draft.tempo.trim()) ||
      Boolean(draft.genre.trim()) ||
      SEGMENT_COLUMNS.some((segment) => Boolean(draft[segment.key]));

    if (!hasAnyValue) {
      setCreateError("Fill at least one cell before saving.");
      return;
    }

    setIsCreatingRow(true);
    setCreateError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/production/smart-segments/rows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table_name: activeTableName,
          song: normalizeTextValue(draft.song, true),
          key_signature: normalizeTextValue(draft.key_signature),
          chords: normalizeTextValue(draft.chords),
          tempo: normalizeTextValue(draft.tempo),
          genre: normalizeTextValue(draft.genre),
          afropop: draft.afropop,
          soft_pop: draft.soft_pop,
          hyper_pop: draft.hyper_pop,
          garage: draft.garage,
          chill_house: draft.chill_house,
          techno: draft.techno,
          reggae: draft.reggae,
          afro_house: draft.afro_house,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save the new row.");
      }

      const createdRow = (await response.json()) as SmartSegmentRow;

      setTables((currentTables) =>
        currentTables.map((table) =>
          table.name === activeTableName
            ? {
                ...table,
                rows: [
                  ...table.rows,
                  {
                    ...createdRow,
                    table_name: normalizeTableName(createdRow.table_name),
                  },
                ],
              }
            : table,
        ),
      );

      setDraftRows((current) => ({
        ...current,
        [activeTableName]: createEmptyDraftRow(),
      }));
    } catch (requestError) {
      setCreateError(
        requestError instanceof Error ? requestError.message : "Failed to save the new row.",
      );
    } finally {
      setIsCreatingRow(false);
    }
  }, [activeTableName, draftRows]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((currentDirection) =>
          currentDirection === "asc" ? "desc" : "asc",
        );
        return currentKey;
      }

      setSortDirection("asc");
      return key;
    });
  }, []);

  const handleSelectRow = useCallback(
    (rowId: number, checked: boolean, shiftKey: boolean) => {
      setSelectedRowIds((current) => {
        const next = new Set(current);

        if (shiftKey && lastSelectedRowId !== null) {
          const startIndex = visibleRows.findIndex((row) => row.id === lastSelectedRowId);
          const endIndex = visibleRows.findIndex((row) => row.id === rowId);

          if (startIndex !== -1 && endIndex !== -1) {
            const [from, to] =
              startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

            visibleRows.slice(from, to + 1).forEach((row) => {
              if (checked) {
                next.add(row.id);
              } else {
                next.delete(row.id);
              }
            });
          } else if (checked) {
            next.add(rowId);
          } else {
            next.delete(rowId);
          }
        } else if (checked) {
          next.add(rowId);
        } else {
          next.delete(rowId);
        }

        return next;
      });

      setLastSelectedRowId(rowId);
    },
    [lastSelectedRowId, visibleRows],
  );

  const handleSelectAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedRowIds((current) => {
        const next = new Set(current);
        visibleRows.forEach((row) => {
          if (checked) {
            next.add(row.id);
          } else {
            next.delete(row.id);
          }
        });
        return next;
      });
    },
    [visibleRows],
  );

  const handleDeleteSelectedRows = useCallback(async () => {
    const activeRowIds = new Set(activeTable.rows.map((row) => row.id));
    const rowIdsToDelete = Array.from(selectedRowIds).filter((rowId) =>
      activeRowIds.has(rowId),
    );

    if (rowIdsToDelete.length === 0) return;

    setIsDeletingRows(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/production/smart-segments/rows`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ row_ids: rowIdsToDelete }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete selected rows.");
      }

      setTables((currentTables) =>
        currentTables.map((table) =>
          table.name === activeTableName
            ? {
                ...table,
                rows: table.rows.filter((row) => !rowIdsToDelete.includes(row.id)),
              }
            : table,
        ),
      );

      setSelectedRowIds((current) => {
        const next = new Set(current);
        rowIdsToDelete.forEach((rowId) => next.delete(rowId));
        return next;
      });
      setLastSelectedRowId(null);
    } catch {
      setError("Failed to delete selected rows.");
    } finally {
      setIsDeletingRows(false);
    }
  }, [activeTable.rows, activeTableName, selectedRowIds]);

  const getStatusLabel = (rowId: number) => {
    const status = saveStatusByRow[rowId];
    if (status === "saving") return "Saving";
    if (status === "saved") return "Saved";
    if (status === "error") return "Error";
    return "";
  };

  const getSortLabel = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "A-Z" : "Z-A";
  };

  const draftRow = draftRows[activeTableName];

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Production</h1>

        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {TABLE_NAMES.map((tableName) => (
              <button
                key={tableName}
                onClick={() => {
                  setActiveTableName(tableName);
                  setSelectedRowIds(new Set());
                  setLastSelectedRowId(null);
                  setSortKey(null);
                  setSortDirection("asc");
                  setCreateError(null);
                }}
                className={
                  activeTableName === tableName
                    ? "h-11 rounded-xl border border-green-500 bg-green-500 px-5 text-sm font-semibold text-black"
                    : "h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-semibold text-zinc-300 hover:border-green-500 hover:text-green-400"
                }
              >
                {tableName}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${activeTableName}...`}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500 sm:w-[280px]"
            />

            {activeSelectedCount > 0 ? (
              <button
                onClick={handleDeleteSelectedRows}
                disabled={isDeletingRows}
                className="h-11 min-w-[132px] whitespace-nowrap rounded-xl border border-red-900/70 bg-red-950/40 px-5 text-sm font-semibold text-red-300 hover:border-red-500 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingRows ? "Deleting..." : `Delete (${activeSelectedCount})`}
              </button>
            ) : null}

            <button
              onClick={loadTables}
              className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-semibold text-zinc-200 hover:border-green-500 hover:text-green-400"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-8 text-sm text-zinc-400">
          Loading production tables...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/30 px-5 py-8 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <section className="mt-10 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex flex-col gap-2 border-b border-zinc-800 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{activeTableName}</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {visibleRows.length} visible rows · {activeTable.rows.length} total rows
              </p>
            </div>

            {createError ? (
              <p className="text-xs font-medium text-red-400">{createError}</p>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] table-fixed border-collapse text-left text-sm">
              <thead className="border-b border-zinc-800 bg-black/40 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="w-[48px] px-3 py-3 text-center font-semibold">
                    <input
                      type="checkbox"
                      checked={visibleRows.length > 0 && selectedVisibleCount === visibleRows.length}
                      onChange={(event) => handleSelectAllVisible(event.target.checked)}
                      className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                      aria-label="Select all visible rows"
                    />
                  </th>

                  {TEXT_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className={`${column.width} px-4 py-3 font-semibold`}
                    >
                      <button
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-2 text-left hover:text-green-400"
                      >
                        <span>{column.label}</span>
                        <span className="text-[10px] normal-case text-zinc-600">
                          {getSortLabel(column.key)}
                        </span>
                      </button>
                    </th>
                  ))}

                  {SEGMENT_COLUMNS.map((segment) => (
                    <th
                      key={segment.key}
                      className="w-[86px] px-2 py-3 text-center font-semibold"
                    >
                      <button
                        onClick={() => handleSort(segment.key)}
                        className="mx-auto flex items-center gap-2 hover:text-green-400"
                      >
                        <span>{segment.label}</span>
                        <span className="text-[10px] normal-case text-zinc-600">
                          {getSortLabel(segment.key)}
                        </span>
                      </button>
                    </th>
                  ))}

                  <th className="w-[70px] px-3 py-3 text-center font-semibold">Save</th>
                  <th className="w-[76px] px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b border-zinc-900 bg-green-950/10">
                  <td className="px-2 py-2 text-center" />

                  {TEXT_COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-2">
                      {column.key === "genre" ? (
                        <select
                          value={String(draftRow.genre || "-")}
                          onChange={(event) =>
                            handleDraftTextChange("genre", event.target.value)
                          }
                          className="h-8 w-full rounded-lg border border-zinc-800 bg-black px-2 text-sm text-white outline-none focus:border-green-500"
                        >
                          {GENRE_OPTIONS.map((genre) => (
                            <option key={genre} value={genre}>
                              {genre === "-" ? "Genre" : genre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={String(draftRow[column.key] || "")}
                          onChange={(event) =>
                            handleDraftTextChange(column.key, event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleCreateRow();
                            }
                          }}
                          placeholder={column.label}
                          className="h-8 w-full rounded-lg border border-zinc-800 bg-black px-2 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-green-500"
                        />
                      )}
                    </td>
                  ))}

                  {SEGMENT_COLUMNS.map((segment) => (
                    <td key={segment.key} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(draftRow[segment.key])}
                        onChange={(event) =>
                          handleDraftSegmentChange(segment.key, event.target.checked)
                        }
                        className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                        aria-label={`New row ${segment.label}`}
                      />
                    </td>
                  ))}

                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={handleCreateRow}
                      disabled={isCreatingRow}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-700 bg-green-500 text-lg font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Save new row"
                      aria-label="Save new row"
                    >
                      ↵
                    </button>
                  </td>

                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {isCreatingRow ? "Saving" : ""}
                  </td>
                </tr>

                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={16}
                      className="px-5 py-8 text-center text-sm text-zinc-500"
                    >
                      No rows match your search.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selectedRowIds.has(row.id)
                          ? "border-b border-zinc-900 bg-green-950/20 last:border-b-0"
                          : "border-b border-zinc-900 last:border-b-0 hover:bg-white/[0.02]"
                      }
                    >
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.has(row.id)}
                          readOnly
                          onClick={(event) => {
                            handleSelectRow(
                              row.id,
                              event.currentTarget.checked,
                              event.shiftKey,
                            );
                          }}
                          className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                          aria-label={`Select ${row.song || "row"}`}
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          value={row.song}
                          onChange={(event) =>
                            handleTextChange(row, "song", event.target.value)
                          }
                          onBlur={(event) =>
                            handleTextBlur(row, "song", event.target.value)
                          }
                          className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-white outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          value={row.key_signature}
                          onChange={(event) =>
                            handleTextChange(row, "key_signature", event.target.value)
                          }
                          onBlur={(event) =>
                            handleTextBlur(row, "key_signature", event.target.value)
                          }
                          className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-zinc-200 outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          value={row.chords}
                          onChange={(event) =>
                            handleTextChange(row, "chords", event.target.value)
                          }
                          onBlur={(event) =>
                            handleTextBlur(row, "chords", event.target.value)
                          }
                          className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-zinc-200 outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          value={row.tempo}
                          onChange={(event) =>
                            handleTextChange(row, "tempo", event.target.value)
                          }
                          onBlur={(event) =>
                            handleTextBlur(row, "tempo", event.target.value)
                          }
                          className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-zinc-200 outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <select
                          value={row.genre || "-"}
                          onChange={(event) =>
                            handleTextChange(row, "genre", event.target.value)
                          }
                          onBlur={(event) =>
                            handleTextBlur(row, "genre", event.target.value)
                          }
                          className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-zinc-200 outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black"
                        >
                          {GENRE_OPTIONS.map((genre) => (
                            <option key={genre} value={genre}>
                              {genre}
                            </option>
                          ))}
                        </select>
                      </td>

                      {SEGMENT_COLUMNS.map((segment) => (
                        <td key={segment.key} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(row[segment.key])}
                            onChange={(event) =>
                              handleSegmentChange(row, segment.key, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                            aria-label={`${row.song} ${segment.label}`}
                          />
                        </td>
                      ))}

                      <td className="px-3 py-2 text-center text-xs text-zinc-600">—</td>

                      <td className="px-3 py-2 text-xs">
                        <span
                          className={
                            saveStatusByRow[row.id] === "error"
                              ? "text-red-400"
                              : saveStatusByRow[row.id] === "saving"
                                ? "text-yellow-400"
                                : saveStatusByRow[row.id] === "saved"
                                  ? "text-green-400"
                                  : "text-zinc-600"
                          }
                        >
                          {getStatusLabel(row.id)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
