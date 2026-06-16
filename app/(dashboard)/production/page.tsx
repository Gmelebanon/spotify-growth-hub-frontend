"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

const DEFAULT_TABLE_NAMES = ["Stems", "Remakes", "Vocals"] as const;
const ALL_TABLES_VIEW = "All";

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
  { key: "song", label: "Song", width: "w-[210px]" },
  { key: "key_signature", label: "Key", width: "w-[94px]" },
  { key: "chords", label: "Chords", width: "w-[140px]" },
  { key: "tempo", label: "Tempo", width: "w-[76px]" },
  { key: "genre", label: "Genre", width: "w-[126px]" },
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

const COLOR_OPTIONS = [
  { value: "", label: "No color" },
  { value: "blue", label: "Blue" },
  { value: "gray", label: "Gray" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "pink", label: "Pink" },
  { value: "purple", label: "Purple" },
  { value: "red", label: "Red" },
  { value: "yellow", label: "Yellow" },
] as const;

type SegmentKey = (typeof SEGMENT_COLUMNS)[number]["key"];
type TextKey = (typeof TEXT_COLUMNS)[number]["key"];
type SortKey = TextKey | SegmentKey | "table_name" | "row_color";
type SortDirection = "asc" | "desc";
type ViewName = string;

type SmartSegmentRow = {
  id: number;
  table_name: string;
  sort_order: number;
  song: string;
  key_signature: string;
  chords: string;
  tempo: string;
  genre: string;
  row_color: string;
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
    | "table_name"
    | "song"
    | "key_signature"
    | "chords"
    | "tempo"
    | "genre"
    | "row_color"
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

type UndoAction =
  | { type: "patchRows"; label: string; rows: SmartSegmentRow[] }
  | { type: "deleteRows"; label: string; rows: SmartSegmentRow[] }
  | { type: "createRow"; label: string; row: SmartSegmentRow }
  | { type: "createSheet"; label: string; sheetName: string };

const EMPTY_DRAFT_ROW: Required<Omit<DraftRow, "table_name">> = {
  song: "",
  key_signature: "",
  chords: "",
  tempo: "",
  genre: "",
  row_color: "",
  afropop: false,
  soft_pop: false,
  hyper_pop: false,
  garage: false,
  chill_house: false,
  techno: false,
  reggae: false,
  afro_house: false,
};

function normalizeTableName(name: string): string {
  const cleanedName = String(name || "").trim();
  return TABLE_NAME_MAP[cleanedName] || cleanedName;
}

function normalizeTextValue(value: string, allowEmpty = false) {
  const cleaned = value.trim();
  if (cleaned.length > 0) return cleaned;
  return allowEmpty ? "" : "-";
}

function normalizeRow(row: SmartSegmentRow): SmartSegmentRow {
  return {
    ...row,
    table_name: normalizeTableName(row.table_name),
    row_color: row.row_color || "",
  };
}

function getComparableValue(row: SmartSegmentRow, key: SortKey) {
  const value = row[key];

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return String(value || "").toLowerCase();
}

function sortRows(
  rows: SmartSegmentRow[],
  key: SortKey | null,
  direction: SortDirection,
) {
  if (!key) {
    return [...rows].sort(
      (a, b) =>
        a.table_name.localeCompare(b.table_name, undefined, {
          sensitivity: "base",
        }) ||
        a.sort_order - b.sort_order ||
        a.id - b.id,
    );
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

function createEmptyDraftRow(): Required<Omit<DraftRow, "table_name">> {
  return { ...EMPTY_DRAFT_ROW };
}

function getRowColorClass(color: string) {
  switch (color) {
    case "blue":
      return "border-l-4 border-l-blue-500 bg-blue-950/10";
    case "gray":
      return "border-l-4 border-l-zinc-500 bg-zinc-800/20";
    case "green":
      return "border-l-4 border-l-green-500 bg-green-950/10";
    case "orange":
      return "border-l-4 border-l-orange-500 bg-orange-950/10";
    case "pink":
      return "border-l-4 border-l-pink-500 bg-pink-950/10";
    case "purple":
      return "border-l-4 border-l-purple-500 bg-purple-950/10";
    case "red":
      return "border-l-4 border-l-red-500 bg-red-950/10";
    case "yellow":
      return "border-l-4 border-l-yellow-500 bg-yellow-950/10";
    default:
      return "border-l-4 border-l-transparent";
  }
}

function getRowTextColorClass(color: string) {
  switch (color) {
    case "blue":
      return "text-blue-300";
    case "gray":
      return "text-zinc-300";
    case "green":
      return "text-green-300";
    case "orange":
      return "text-orange-300";
    case "pink":
      return "text-pink-300";
    case "purple":
      return "text-purple-300";
    case "red":
      return "text-red-300";
    case "yellow":
      return "text-yellow-300";
    default:
      return "text-zinc-200";
  }
}


function getRowTextColorStyle(color: string) {
  switch (color) {
    case "blue":
      return { color: "#93c5fd" };
    case "gray":
      return { color: "#d4d4d8" };
    case "green":
      return { color: "#86efac" };
    case "orange":
      return { color: "#fdba74" };
    case "pink":
      return { color: "#f9a8d4" };
    case "purple":
      return { color: "#d8b4fe" };
    case "red":
      return { color: "#fca5a5" };
    case "yellow":
      return { color: "#fde047" };
    default:
      return undefined;
  }
}

function rowToRestorePayload(row: SmartSegmentRow): RowPatch {
  return {
    table_name: row.table_name,
    song: row.song,
    key_signature: row.key_signature,
    chords: row.chords,
    tempo: row.tempo,
    genre: row.genre,
    row_color: row.row_color || "",
    afropop: row.afropop,
    soft_pop: row.soft_pop,
    hyper_pop: row.hyper_pop,
    garage: row.garage,
    chill_house: row.chill_house,
    techno: row.techno,
    reggae: row.reggae,
    afro_house: row.afro_house,
  };
}

export default function ProductionPage() {
  const [tables, setTables] = useState<SmartSegmentTable[]>([]);
  const [activeViewName, setActiveViewName] = useState<ViewName>("Stems");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [lastSelectedRowId, setLastSelectedRowId] = useState<number | null>(
    null,
  );
  const [saveStatusByRow, setSaveStatusByRow] = useState<
    Record<number, SaveStatus>
  >({});
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [draftRows, setDraftRows] = useState<
    Record<string, Required<Omit<DraftRow, "table_name">>>
  >({
    Stems: createEmptyDraftRow(),
    Remakes: createEmptyDraftRow(),
    Vocals: createEmptyDraftRow(),
  });
  const [isCreatingRow, setIsCreatingRow] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isDeletingRows, setIsDeletingRows] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const [isRenameSheetOpen, setIsRenameSheetOpen] = useState(false);
  const [renameSheetName, setRenameSheetName] = useState("");
  const [sheetActionError, setSheetActionError] = useState<string | null>(null);
  const [isDeletingSheet, setIsDeletingSheet] = useState(false);
  const [isRenamingSheet, setIsRenamingSheet] = useState(false);

  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const patchesRef = useRef<Record<number, RowPatch>>({});
  const selectedRowIdsRef = useRef<Set<number>>(new Set());
  const focusedCellStartRef = useRef<{
    rowId: number;
    field: TextKey;
    row: SmartSegmentRow;
  } | null>(null);

  const tableNames = useMemo(() => {
    const names: string[] = [];
    [...DEFAULT_TABLE_NAMES, ...tables.map((table) => table.name)].forEach(
      (name) => {
        const normalizedName = normalizeTableName(name);
        if (normalizedName && !names.includes(normalizedName)) {
          names.push(normalizedName);
        }
      },
    );
    return names;
  }, [tables]);

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((current) => [...current.slice(-24), action]);
  }, []);

  const loadTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production tables.");
      }

      const data = (await response.json()) as SmartSegmentTable[];
      const normalizedData = data.map((table) => ({
        name: normalizeTableName(table.name),
        rows: table.rows.map(normalizeRow),
      }));

      const tablesByName = new Map<string, SmartSegmentTable>();
      normalizedData.forEach((table) => {
        const tableName = normalizeTableName(table.name);
        tablesByName.set(tableName, {
          name: tableName,
          rows: [...(tablesByName.get(tableName)?.rows || []), ...table.rows],
        });
      });

      const orderedNames: string[] = [];
      [
        ...DEFAULT_TABLE_NAMES,
        ...normalizedData.map((table) => table.name),
      ].forEach((name) => {
        const normalizedName = normalizeTableName(name);
        if (normalizedName && !orderedNames.includes(normalizedName)) {
          orderedNames.push(normalizedName);
        }
      });

      setTables(
        orderedNames.map((tableName) => ({
          name: tableName,
          rows: tablesByName.get(tableName)?.rows || [],
        })),
      );
      setDraftRows((current) => {
        const next = { ...current };
        orderedNames.forEach((name) => {
          if (!next[name]) next[name] = createEmptyDraftRow();
        });
        return next;
      });
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

  useEffect(() => {
    selectedRowIdsRef.current = selectedRowIds;
  }, [selectedRowIds]);

  const isAllView = activeViewName === ALL_TABLES_VIEW;

  const activeRows = useMemo(() => {
    if (isAllView) {
      return tables.flatMap((table) => table.rows);
    }

    return tables.find((table) => table.name === activeViewName)?.rows || [];
  }, [activeViewName, isAllView, tables]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filteredRows = !query
      ? activeRows
      : activeRows.filter((row) =>
          [
            row.table_name,
            row.song,
            row.key_signature,
            row.chords,
            row.tempo,
            row.genre,
            row.row_color,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        );

    return sortRows(filteredRows, sortKey, sortDirection);
  }, [activeRows, search, sortDirection, sortKey]);

  const selectedVisibleCount = useMemo(() => {
    return visibleRows.filter((row) => selectedRowIds.has(row.id)).length;
  }, [selectedRowIds, visibleRows]);

  const activeSelectedRows = useMemo(() => {
    const activeRowIds = new Set(activeRows.map((row) => row.id));
    return tables
      .flatMap((table) => table.rows)
      .filter((row) => activeRowIds.has(row.id) && selectedRowIds.has(row.id));
  }, [activeRows, selectedRowIds, tables]);

  const activeSelectedCount = activeSelectedRows.length;

  const updateRowLocally = useCallback((rowId: number, patch: RowPatch) => {
    setTables((currentTables) =>
      currentTables.map((table) => ({
        ...table,
        rows: table.rows.map((row) =>
          row.id === rowId
            ? normalizeRow({
                ...row,
                ...patch,
              })
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

      const savedRow = normalizeRow((await response.json()) as SmartSegmentRow);
      setTables((currentTables) =>
        currentTables.map((table) => ({
          ...table,
          rows: table.rows.map((row) => (row.id === rowId ? savedRow : row)),
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
  }, []);

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

  const handleTextFocus = useCallback(
    (row: SmartSegmentRow, field: TextKey) => {
      focusedCellStartRef.current = { rowId: row.id, field, row: { ...row } };
    },
    [],
  );

  const handleTextBlur = useCallback(
    (row: SmartSegmentRow, field: TextKey, value: string) => {
      const finalValue = normalizeTextValue(value, field === "song");
      const patch = { [field]: finalValue } as RowPatch;
      updateRowLocally(row.id, patch);
      scheduleSave(row.id, patch);

      const start = focusedCellStartRef.current;
      if (start && start.rowId === row.id && start.field === field) {
        const previousValue = start.row[field];
        if (String(previousValue || "") !== finalValue) {
          pushUndo({
            type: "patchRows",
            label: `Undo ${field}`,
            rows: [start.row],
          });
        }
      }
      focusedCellStartRef.current = null;
    },
    [pushUndo, scheduleSave, updateRowLocally],
  );

  const handleSegmentChange = useCallback(
    (row: SmartSegmentRow, field: SegmentKey, value: boolean) => {
      pushUndo({
        type: "patchRows",
        label: "Undo checkbox",
        rows: [{ ...row }],
      });
      const patch = { [field]: value } as RowPatch;
      updateRowLocally(row.id, patch);
      scheduleSave(row.id, patch);
    },
    [pushUndo, scheduleSave, updateRowLocally],
  );

  const handleDraftTextChange = useCallback(
    (field: TextKey, value: string) => {
      if (isAllView) return;
      setCreateError(null);
      setDraftRows((current) => ({
        ...current,
        [activeViewName]: {
          ...(current[activeViewName] || createEmptyDraftRow()),
          [field]: value,
        },
      }));
    },
    [activeViewName, isAllView],
  );

  const handleDraftSegmentChange = useCallback(
    (field: SegmentKey, value: boolean) => {
      if (isAllView) return;
      setCreateError(null);
      setDraftRows((current) => ({
        ...current,
        [activeViewName]: {
          ...(current[activeViewName] || createEmptyDraftRow()),
          [field]: value,
        },
      }));
    },
    [activeViewName, isAllView],
  );

  const handleCreateRow = useCallback(async () => {
    if (isAllView) return;
    const draft = draftRows[activeViewName] || createEmptyDraftRow();
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
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments/rows`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table_name: activeViewName,
            song: normalizeTextValue(draft.song, true),
            key_signature: normalizeTextValue(draft.key_signature),
            chords: normalizeTextValue(draft.chords),
            tempo: normalizeTextValue(draft.tempo),
            genre: normalizeTextValue(draft.genre),
            row_color: "",
            afropop: draft.afropop,
            soft_pop: draft.soft_pop,
            hyper_pop: draft.hyper_pop,
            garage: draft.garage,
            chill_house: draft.chill_house,
            techno: draft.techno,
            reggae: draft.reggae,
            afro_house: draft.afro_house,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save the new row.");
      }

      const createdRow = normalizeRow(
        (await response.json()) as SmartSegmentRow,
      );

      setTables((currentTables) =>
        currentTables.map((table) =>
          table.name === activeViewName
            ? {
                ...table,
                rows: [...table.rows, createdRow],
              }
            : table,
        ),
      );

      pushUndo({
        type: "createRow",
        label: "Undo row create",
        row: createdRow,
      });
      setDraftRows((current) => ({
        ...current,
        [activeViewName]: createEmptyDraftRow(),
      }));
    } catch (requestError) {
      setCreateError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save the new row.",
      );
    } finally {
      setIsCreatingRow(false);
    }
  }, [activeViewName, draftRows, isAllView, pushUndo]);

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
          const startIndex = visibleRows.findIndex(
            (row) => row.id === lastSelectedRowId,
          );
          const endIndex = visibleRows.findIndex((row) => row.id === rowId);

          if (startIndex !== -1 && endIndex !== -1) {
            const [from, to] =
              startIndex < endIndex
                ? [startIndex, endIndex]
                : [endIndex, startIndex];

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
    const rowsToDelete = activeSelectedRows.map((row) => ({ ...row }));
    const rowIdsToDelete = rowsToDelete.map((row) => row.id);

    if (rowIdsToDelete.length === 0) return;

    setIsDeletingRows(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments/rows`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ row_ids: rowIdsToDelete }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete selected rows.");
      }

      setTables((currentTables) =>
        currentTables.map((table) => ({
          ...table,
          rows: table.rows.filter((row) => !rowIdsToDelete.includes(row.id)),
        })),
      );

      pushUndo({
        type: "deleteRows",
        label: "Undo delete",
        rows: rowsToDelete,
      });
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
  }, [activeSelectedRows, pushUndo]);

  const handleCreateSheet = useCallback(async () => {
    const sheetName = normalizeTableName(newSheetName);
    if (!sheetName) {
      setSheetError("Sheet name is required.");
      return;
    }

    if (tableNames.includes(sheetName)) {
      setSheetError("A sheet with this name already exists.");
      return;
    }

    setIsCreatingSheet(true);
    setSheetError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments/sheets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: sheetName }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to create sheet.");
      }

      const createdSheet = (await response.json()) as SmartSegmentTable;
      const normalizedSheetName = normalizeTableName(createdSheet.name);

      setTables((currentTables) => [
        ...currentTables,
        { name: normalizedSheetName, rows: [] },
      ]);
      setDraftRows((current) => ({
        ...current,
        [normalizedSheetName]: createEmptyDraftRow(),
      }));
      setActiveViewName(normalizedSheetName);
      setNewSheetName("");
      setIsCreateSheetOpen(false);
      pushUndo({
        type: "createSheet",
        label: "Undo sheet create",
        sheetName: normalizedSheetName,
      });
    } catch (requestError) {
      setSheetError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create sheet.",
      );
    } finally {
      setIsCreatingSheet(false);
    }
  }, [newSheetName, pushUndo, tableNames]);

  const handleDeleteSheet = useCallback(async () => {
    if (isAllView || !activeViewName) return;

    setIsDeletingSheet(true);
    setSheetActionError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/production/smart-segments/sheets/${encodeURIComponent(activeViewName)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Failed to delete sheet.");
      }

      setTables((currentTables) => {
        const nextTables = currentTables.filter(
          (table) => table.name !== activeViewName,
        );
        const nextActive = nextTables[0]?.name || ALL_TABLES_VIEW;
        setActiveViewName(nextActive);
        return nextTables;
      });
      setSelectedRowIds(new Set());
      setLastSelectedRowId(null);
      setIsDeleteSheetOpen(false);
    } catch (requestError) {
      setSheetActionError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete sheet.",
      );
    } finally {
      setIsDeletingSheet(false);
    }
  }, [activeViewName, isAllView]);

  const handleRenameSheet = useCallback(async () => {
    if (isAllView || !activeViewName) return;

    const nextName = normalizeTableName(renameSheetName);
    if (!nextName) {
      setSheetActionError("Sheet name is required.");
      return;
    }

    if (nextName !== activeViewName && tableNames.includes(nextName)) {
      setSheetActionError("A sheet with this name already exists.");
      return;
    }

    setIsRenamingSheet(true);
    setSheetActionError(null);

    try {
      const renameUrl = `${API_BASE_URL}/api/production/smart-segments/sheets/${encodeURIComponent(activeViewName)}`;
      const renameBody = JSON.stringify({ name: nextName });

      let response = await fetch(renameUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: renameBody,
      });

      if (response.status === 405) {
        response = await fetch(renameUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: renameBody,
        });
      }

      if (response.status === 405) {
        response = await fetch(`${renameUrl}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: renameBody,
        });
      }

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || "Failed to rename sheet.");
      }

      const renamedSheet = (await response.json()) as SmartSegmentTable;
      const normalizedName = normalizeTableName(renamedSheet.name);
      const normalizedRows = renamedSheet.rows.map(normalizeRow);

      setTables((currentTables) =>
        currentTables.map((table) =>
          table.name === activeViewName
            ? { name: normalizedName, rows: normalizedRows }
            : table,
        ),
      );
      setDraftRows((current) => {
        const next = { ...current };
        next[normalizedName] = next[activeViewName] || createEmptyDraftRow();
        if (normalizedName !== activeViewName) delete next[activeViewName];
        return next;
      });
      setActiveViewName(normalizedName);
      setIsRenameSheetOpen(false);
    } catch (requestError) {
      setSheetActionError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to rename sheet.",
      );
    } finally {
      setIsRenamingSheet(false);
    }
  }, [activeViewName, isAllView, renameSheetName, tableNames]);

  const bulkUpdateSelectedRows = useCallback(
    async (
      patch: Pick<RowPatch, "row_color" | "table_name">,
      label: string,
    ) => {
      const selectedIds = new Set(selectedRowIds);
      const activeRowIds = new Set(activeRows.map((row) => row.id));
      const rowsBeforeUpdate = tables
        .flatMap((table) => table.rows)
        .filter((row) => selectedIds.has(row.id) && activeRowIds.has(row.id))
        .map((row) => ({ ...row }));
      const rowIds = rowsBeforeUpdate.map((row) => row.id);
      if (rowIds.length === 0) return;

      setIsBulkUpdating(true);
      setError(null);

      const optimisticRows = rowsBeforeUpdate.map((row) =>
        normalizeRow({ ...row, ...patch }),
      );
      const optimisticRowsById = new Map(
        optimisticRows.map((row) => [row.id, row]),
      );

      setTables((currentTables) => {
        const remainingTables = currentTables.map((table) => ({
          ...table,
          rows: table.rows.filter((row) => !optimisticRowsById.has(row.id)),
        }));

        const tablesByName = new Map(
          remainingTables.map((table) => [table.name, table]),
        );

        optimisticRows.forEach((row) => {
          const tableName = normalizeTableName(row.table_name);
          if (!tablesByName.has(tableName)) {
            const newTable = {
              name: tableName,
              rows: [] as SmartSegmentRow[],
            };
            tablesByName.set(tableName, newTable);
            remainingTables.push(newTable);
          }
          tablesByName.get(tableName)?.rows.push(row);
        });

        return remainingTables;
      });

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/production/smart-segments/rows/bulk`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ row_ids: rowIds, ...patch }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update selected rows.");
        }

        const updatedRows = ((await response.json()) as SmartSegmentRow[]).map(
          normalizeRow,
        );
        const updatedRowsById = new Map(
          updatedRows.map((row) => [row.id, row]),
        );

        setTables((currentTables) => {
          const remainingTables = currentTables.map((table) => ({
            ...table,
            rows: table.rows.filter((row) => !updatedRowsById.has(row.id)),
          }));

          const tablesByName = new Map(
            remainingTables.map((table) => [table.name, table]),
          );
          updatedRows.forEach((row) => {
            const tableName = normalizeTableName(row.table_name);
            if (!tablesByName.has(tableName)) {
              const newTable = {
                name: tableName,
                rows: [] as SmartSegmentRow[],
              };
              tablesByName.set(tableName, newTable);
              remainingTables.push(newTable);
            }
            tablesByName.get(tableName)?.rows.push(row);
          });

          return remainingTables;
        });

        pushUndo({ type: "patchRows", label, rows: rowsBeforeUpdate });
        if (patch.table_name) {
          setSelectedRowIds(new Set());
          selectedRowIdsRef.current = new Set();
          setLastSelectedRowId(null);
        }
      } catch {
        const previousRowsById = new Map(
          rowsBeforeUpdate.map((row) => [row.id, row]),
        );

        setTables((currentTables) => {
          const remainingTables = currentTables.map((table) => ({
            ...table,
            rows: table.rows.filter((row) => !previousRowsById.has(row.id)),
          }));

          const tablesByName = new Map(
            remainingTables.map((table) => [table.name, table]),
          );
          rowsBeforeUpdate.forEach((row) => {
            const tableName = normalizeTableName(row.table_name);
            if (!tablesByName.has(tableName)) {
              const restoredTable = {
                name: tableName,
                rows: [] as SmartSegmentRow[],
              };
              tablesByName.set(tableName, restoredTable);
              remainingTables.push(restoredTable);
            }
            tablesByName.get(tableName)?.rows.push(row);
          });

          return remainingTables;
        });
        setError("Failed to update selected rows.");
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [activeRows, pushUndo, selectedRowIds, tables],
  );

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || isUndoing) return;

    const action = undoStack[undoStack.length - 1];
    setIsUndoing(true);
    setError(null);

    try {
      if (action.type === "createRow") {
        const response = await fetch(
          `${API_BASE_URL}/api/production/smart-segments/rows`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ row_ids: [action.row.id] }),
          },
        );
        if (!response.ok) throw new Error("Undo failed.");
        setTables((currentTables) =>
          currentTables.map((table) => ({
            ...table,
            rows: table.rows.filter((row) => row.id !== action.row.id),
          })),
        );
      }

      if (action.type === "deleteRows") {
        const response = await fetch(
          `${API_BASE_URL}/api/production/smart-segments/rows/restore`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: action.rows.map(rowToRestorePayload),
            }),
          },
        );
        if (!response.ok) throw new Error("Undo failed.");
        const restoredRows = ((await response.json()) as SmartSegmentRow[]).map(
          normalizeRow,
        );
        setTables((currentTables) => {
          const tablesByName = new Map(
            currentTables.map((table) => [
              table.name,
              { ...table, rows: [...table.rows] },
            ]),
          );
          restoredRows.forEach((row) => {
            if (!tablesByName.has(row.table_name)) {
              tablesByName.set(row.table_name, {
                name: row.table_name,
                rows: [],
              });
            }
            tablesByName.get(row.table_name)?.rows.push(row);
          });
          return Array.from(tablesByName.values());
        });
      }

      if (action.type === "patchRows") {
        const restoredRows = await Promise.all(
          action.rows.map(async (row) => {
            const response = await fetch(
              `${API_BASE_URL}/api/production/smart-segments/rows/${row.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rowToRestorePayload(row)),
              },
            );
            if (!response.ok) throw new Error("Undo failed.");
            return normalizeRow((await response.json()) as SmartSegmentRow);
          }),
        );
        const restoredRowsById = new Map(
          restoredRows.map((row) => [row.id, row]),
        );
        setTables((currentTables) => {
          const withoutRows = currentTables.map((table) => ({
            ...table,
            rows: table.rows.filter((row) => !restoredRowsById.has(row.id)),
          }));
          const tablesByName = new Map(
            withoutRows.map((table) => [table.name, table]),
          );
          restoredRows.forEach((row) => {
            if (!tablesByName.has(row.table_name)) {
              const newTable = {
                name: row.table_name,
                rows: [] as SmartSegmentRow[],
              };
              tablesByName.set(row.table_name, newTable);
              withoutRows.push(newTable);
            }
            tablesByName.get(row.table_name)?.rows.push(row);
          });
          return withoutRows;
        });
      }

      if (action.type === "createSheet") {
        const response = await fetch(
          `${API_BASE_URL}/api/production/smart-segments/sheets/${encodeURIComponent(action.sheetName)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Undo failed.");
        setTables((currentTables) =>
          currentTables.filter((table) => table.name !== action.sheetName),
        );
        setActiveViewName((current) =>
          current === action.sheetName ? "Stems" : current,
        );
      }

      setUndoStack((current) => current.slice(0, -1));
    } catch {
      setError("Undo failed. Refresh the page and try again.");
    } finally {
      setIsUndoing(false);
    }
  }, [isUndoing, undoStack]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (undoStack.length > 0) {
          event.preventDefault();
          handleUndo();
        }
      }

      if (event.key === "Escape") {
        setIsCreateSheetOpen(false);
        setIsDeleteSheetOpen(false);
        setIsRenameSheetOpen(false);
        setSheetError(null);
        setSheetActionError(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, undoStack.length]);

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

  const draftRow = isAllView
    ? createEmptyDraftRow()
    : draftRows[activeViewName] || createEmptyDraftRow();
  const tableColumnCount = isAllView ? 17 : 16;

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Production</h1>

        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {[ALL_TABLES_VIEW, ...tableNames].map((tableName) => (
              <button
                key={tableName}
                onClick={() => {
                  setActiveViewName(tableName);
                  setSelectedRowIds(new Set());
                  setLastSelectedRowId(null);
                  setSortKey(null);
                  setSortDirection("asc");
                  setCreateError(null);
                }}
                className={
                  activeViewName === tableName
                    ? "h-11 rounded-xl border border-green-500 bg-green-500 px-5 text-sm font-semibold text-black"
                    : "h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-semibold text-zinc-300 hover:border-green-500 hover:text-green-400"
                }
              >
                {tableName}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${activeViewName}...`}
              className="h-11 w-[230px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
            />

            <button
              onClick={() => {
                setIsCreateSheetOpen(true);
                setNewSheetName("");
                setSheetError(null);
              }}
              className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-semibold text-zinc-200 hover:border-green-500 hover:text-green-400"
            >
              Create
            </button>

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

            {activeSelectedCount > 0 ? (
              <>
                <button
                  onClick={handleDeleteSelectedRows}
                  disabled={isDeletingRows}
                  className="h-11 min-w-[132px] whitespace-nowrap rounded-xl border border-red-900/70 bg-red-950/40 px-5 text-sm font-semibold text-red-300 hover:border-red-500 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingRows
                    ? "Deleting..."
                    : `Delete (${activeSelectedCount})`}
                </button>

                <select
                  value="__placeholder"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value !== "__placeholder") {
                      bulkUpdateSelectedRows(
                        { row_color: value },
                        "Undo color",
                      );
                    }
                  }}
                  disabled={isBulkUpdating}
                  className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-200 outline-none hover:border-green-500 focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="__placeholder">Color</option>
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color.value || "none"} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>

                <select
                  value=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) {
                      bulkUpdateSelectedRows(
                        { table_name: value },
                        "Undo move",
                      );
                    }
                  }}
                  disabled={isBulkUpdating}
                  className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-200 outline-none hover:border-green-500 focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Move to</option>
                  {tableNames.map((tableName) => (
                    <option key={tableName} value={tableName}>
                      {tableName}
                    </option>
                  ))}
                </select>
              </>
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
        <section className="mt-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-white">
              {activeViewName}
            </h2>

            <div className="flex items-center gap-3">
              {createError ? (
                <p className="text-xs font-medium text-red-400">
                  {createError}
                </p>
              ) : null}

              {!isAllView ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRenameSheetName(activeViewName);
                      setSheetActionError(null);
                      setIsRenameSheetOpen(true);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-black text-zinc-400 hover:border-green-500 hover:text-green-400"
                    aria-label="Rename sheet"
                    title="Rename sheet"
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
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSheetActionError(null);
                      setIsDeleteSheetOpen(true);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-black text-zinc-400 hover:border-red-500 hover:text-red-400"
                    aria-label="Delete sheet"
                    title="Delete sheet"
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
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] table-fixed border-collapse text-left text-sm">
              <thead className="border-b border-zinc-800 bg-black/40 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="w-[46px] px-2 py-3 text-center font-semibold">
                    <input
                      type="checkbox"
                      checked={
                        visibleRows.length > 0 &&
                        selectedVisibleCount === visibleRows.length
                      }
                      onChange={(event) =>
                        handleSelectAllVisible(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                      aria-label="Select all visible rows"
                    />
                  </th>

                  {isAllView ? (
                    <th className="w-[110px] px-3 py-3 font-semibold">
                      <button
                        onClick={() => handleSort("table_name")}
                        className="flex items-center gap-2 text-left hover:text-green-400"
                      >
                        <span>Sheet</span>
                        <span className="text-[10px] normal-case text-zinc-600">
                          {getSortLabel("table_name")}
                        </span>
                      </button>
                    </th>
                  ) : null}

                  {TEXT_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className={`${column.width} px-3 py-3 font-semibold`}
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
                      className="w-[84px] px-2 py-3 text-center font-semibold"
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

                  <th className="w-[72px] px-2 py-3 text-center font-semibold">
                    Save
                  </th>
                  <th className="w-[76px] px-2 py-3 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody>
                {!isAllView ? (
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
                              handleDraftTextChange(
                                column.key,
                                event.target.value,
                              )
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
                            handleDraftSegmentChange(
                              segment.key,
                              event.target.checked,
                            )
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

                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {isCreatingRow ? "Saving" : ""}
                    </td>
                  </tr>
                ) : null}

                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tableColumnCount}
                      className="px-5 py-8 text-center text-sm text-zinc-500"
                    >
                      No rows match your search.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const rowTextClass = getRowTextColorClass(row.row_color);
                    const rowTextStyle = getRowTextColorStyle(row.row_color);

                    return (
                      <tr
                        key={row.id}
                        style={rowTextStyle}
                        className={
                          selectedRowIds.has(row.id)
                            ? `${getRowColorClass(row.row_color)} border-b border-zinc-900 bg-green-950/20 last:border-b-0`
                            : `${getRowColorClass(row.row_color)} border-b border-zinc-900 last:border-b-0 hover:bg-white/[0.02]`
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
                                !selectedRowIdsRef.current.has(row.id),
                                event.shiftKey,
                              );
                            }}
                            className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                            aria-label={`Select ${row.song || "row"}`}
                          />
                        </td>

                        {isAllView ? (
                          <td
                            className={`px-2 py-2 text-xs font-medium ${rowTextClass}`}
                            style={rowTextStyle}
                          >
                            {row.table_name}
                          </td>
                        ) : null}

                        <td className="px-2 py-2">
                          <input
                            value={row.song}
                            onFocus={() => handleTextFocus(row, "song")}
                            onChange={(event) =>
                              handleTextChange(row, "song", event.target.value)
                            }
                            onBlur={(event) =>
                              handleTextBlur(row, "song", event.target.value)
                            }
                            className={`h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm ${rowTextClass} outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black`}
                            style={rowTextStyle}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            value={row.key_signature}
                            onFocus={() =>
                              handleTextFocus(row, "key_signature")
                            }
                            onChange={(event) =>
                              handleTextChange(
                                row,
                                "key_signature",
                                event.target.value,
                              )
                            }
                            onBlur={(event) =>
                              handleTextBlur(
                                row,
                                "key_signature",
                                event.target.value,
                              )
                            }
                            className={`h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm ${rowTextClass} outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black`}
                            style={rowTextStyle}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            value={row.chords}
                            onFocus={() => handleTextFocus(row, "chords")}
                            onChange={(event) =>
                              handleTextChange(
                                row,
                                "chords",
                                event.target.value,
                              )
                            }
                            onBlur={(event) =>
                              handleTextBlur(row, "chords", event.target.value)
                            }
                            className={`h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm ${rowTextClass} outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black`}
                            style={rowTextStyle}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            value={row.tempo}
                            onFocus={() => handleTextFocus(row, "tempo")}
                            onChange={(event) =>
                              handleTextChange(row, "tempo", event.target.value)
                            }
                            onBlur={(event) =>
                              handleTextBlur(row, "tempo", event.target.value)
                            }
                            className={`h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm ${rowTextClass} outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black`}
                            style={rowTextStyle}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <select
                            value={row.genre || "-"}
                            onFocus={() => handleTextFocus(row, "genre")}
                            onChange={(event) =>
                              handleTextChange(row, "genre", event.target.value)
                            }
                            onBlur={(event) =>
                              handleTextBlur(row, "genre", event.target.value)
                            }
                            className={`h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm ${rowTextClass} outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black`}
                            style={rowTextStyle}
                          >
                            {GENRE_OPTIONS.map((genre) => (
                              <option key={genre} value={genre}>
                                {genre}
                              </option>
                            ))}
                          </select>
                        </td>

                        {SEGMENT_COLUMNS.map((segment) => (
                          <td
                            key={segment.key}
                            className="px-2 py-2 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(row[segment.key])}
                              onChange={(event) =>
                                handleSegmentChange(
                                  row,
                                  segment.key,
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4 rounded border-zinc-700 bg-black accent-green-500"
                              aria-label={`${row.song} ${segment.label}`}
                            />
                          </td>
                        ))}

                        <td
                          className={`px-2 py-2 text-center text-xs ${rowTextClass}`}
                          style={rowTextStyle}
                        >
                          —
                        </td>

                        <td className="px-2 py-2 text-xs">
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isCreateSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsCreateSheetOpen(false);
              setSheetError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white">Create sheet</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Add a new Production table.
              </p>
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Sheet name
            </label>
            <input
              autoFocus
              value={newSheetName}
              onChange={(event) => {
                setNewSheetName(event.target.value);
                setSheetError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateSheet();
                }
              }}
              placeholder="Example: Hooks"
              className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
            />

            {sheetError ? (
              <p className="mt-3 text-sm text-red-400">{sheetError}</p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreateSheetOpen(false);
                  setSheetError(null);
                }}
                className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSheet}
                disabled={isCreatingSheet}
                className="h-10 rounded-xl border border-green-500 bg-green-500 px-5 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingSheet ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRenameSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsRenameSheetOpen(false);
              setSheetActionError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white">Rename sheet</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Change the name of {activeViewName}.
              </p>
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Sheet name
            </label>
            <input
              autoFocus
              value={renameSheetName}
              onChange={(event) => {
                setRenameSheetName(event.target.value);
                setSheetActionError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleRenameSheet();
                }
              }}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
            />

            {sheetActionError ? (
              <p className="mt-3 text-sm text-red-400">{sheetActionError}</p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsRenameSheetOpen(false);
                  setSheetActionError(null);
                }}
                className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSheet}
                disabled={isRenamingSheet}
                className="h-10 rounded-xl border border-green-500 bg-green-500 px-5 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRenamingSheet ? "Renaming..." : "Rename"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsDeleteSheetOpen(false);
              setSheetActionError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white">
                Delete sheet?
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                This will delete {activeViewName} and all rows inside it.
              </p>
            </div>

            {sheetActionError ? (
              <p className="mb-3 text-sm text-red-400">{sheetActionError}</p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteSheetOpen(false);
                  setSheetActionError(null);
                }}
                className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSheet}
                disabled={isDeletingSheet}
                className="h-10 rounded-xl border border-red-500 bg-red-500 px-5 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingSheet ? "Deleting..." : "Delete sheet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
