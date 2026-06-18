"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

const STATUS_OPTIONS = [
  "In Progress",
  "Online",
  "Rejected",
  "Scheduled",
  "Approved",
  "No Artist",
];

const STATUS_STYLES: Record<string, string> = {
  "In Progress": "bg-yellow-400 text-black",
  Online: "bg-green-600 text-white",
  Rejected: "bg-red-600 text-white",
  Scheduled: "bg-blue-600 text-white",
  Approved: "bg-purple-600 text-white",
  "No Artist": "bg-orange-500 text-white",
};

const STATUS_TEXT: Record<string, string> = {
  "In Progress": "text-yellow-300",
  Online: "text-green-400",
  Rejected: "text-red-400",
  Scheduled: "text-blue-400",
  Approved: "text-purple-400",
  "No Artist": "text-orange-400",
};

type SchedulingSheet = {
  id: number;
  name: string;
  sort_order: number;
};

type SchedulingRow = {
  id: number;
  sheet_id: number | null;
  sort_order: number;
  is_selected: boolean;
  genre: string;
  status: string;
  artist: string;
  album: string;
  song: string;
  release_date: string;
  platform_status: string;
  rn_account: string;
  remarks: string;
};

type SchedulingPayload = {
  sheets: SchedulingSheet[];
  rows: SchedulingRow[];
};

type NewRow = Omit<SchedulingRow, "id" | "sort_order" | "sheet_id">;

type TextField =
  | "genre"
  | "status"
  | "artist"
  | "album"
  | "song"
  | "release_date"
  | "platform_status"
  | "rn_account"
  | "remarks";

type SortField = TextField;

type Column = {
  label: string;
  field: TextField;
  width: string;
  type?: "status" | "date" | "platform";
};

type UndoAction =
  | {
      type: "edit";
      rowId: number;
      field: TextField | "is_selected";
      previousValue: string | boolean;
      nextValue: string | boolean;
    }
  | {
      type: "create";
      row: SchedulingRow;
    }
  | {
      type: "delete";
      rows: SchedulingRow[];
    }
  | {
      type: "renameSheet";
      sheetId: number;
      previousName: string;
      nextName: string;
    };

type HeaderFilterDraft = {
  query: string;
  selected: string[];
};

const EMPTY_NEW_ROW: NewRow = {
  is_selected: false,
  genre: "",
  status: "",
  artist: "",
  album: "",
  song: "",
  release_date: "",
  platform_status: "",
  rn_account: "",
  remarks: "",
};

const COLUMNS: Column[] = [
  { label: "Genre", field: "genre", width: "min-w-[150px]" },
  { label: "Status", field: "status", width: "min-w-[150px]", type: "status" },
  { label: "Artist", field: "artist", width: "min-w-[190px]" },
  { label: "Album", field: "album", width: "min-w-[160px]" },
  { label: "Song", field: "song", width: "min-w-[230px]" },
  { label: "Release Date", field: "release_date", width: "min-w-[160px]", type: "date" },
  {
    label: "Platform Status",
    field: "platform_status",
    width: "min-w-[160px]",
    type: "platform",
  },
  { label: "RN Account", field: "rn_account", width: "min-w-[150px]" },
  { label: "Remarks", field: "remarks", width: "min-w-[280px]" },
];

function normalizeValue(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return value;
  return String(value ?? "").trim();
}

function statusClass(value: string) {
  return STATUS_STYLES[value] || "bg-zinc-800 text-zinc-300";
}

function statusTextClass(value: string) {
  return STATUS_TEXT[value] || "text-white";
}

function StatusBadge({ value }: { value: string }) {
  const label = value || "-";

  if (!value || value === "-") {
    return <span className="text-zinc-600">—</span>;
  }

  if (label === "Rejected") {
    return (
      <span
        className="inline-flex rounded-md px-2 py-1 text-xs font-bold"
        style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
      >
        Rejected
      </span>
    );
  }

  if (label === "Online") {
    return (
      <span
        className="inline-flex rounded-md px-2 py-1 text-xs font-bold"
        style={{ backgroundColor: "#16a34a", color: "#ffffff" }}
      >
        Online
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${statusClass(
        label,
      )}`}
    >
      {label}
    </span>
  );
}

function formatDateForInput(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function platformStatusForRow(row: SchedulingRow, onlineSongs: Set<string>) {
  const songKey = row.song.trim().toLowerCase();
  const storedStatus = String(row.platform_status || "").trim().toLowerCase();
  const status = String(row.status || "").trim();

  if (
    storedStatus === "online" ||
    status === "Online" ||
    (songKey && onlineSongs.has(songKey))
  ) {
    return "Online";
  }

  if (storedStatus === "rejected" || status === "Rejected") {
    return "Rejected";
  }

  return "";
}

export default function SchedulingPage() {
  const [sheets, setSheets] = useState<SchedulingSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<number | null>(null);
  const [rows, setRows] = useState<SchedulingRow[]>([]);
  const [newRow, setNewRow] = useState<NewRow>(EMPTY_NEW_ROW);
  const [showNewRow, setShowNewRow] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("release_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [editingSheetName, setEditingSheetName] = useState(false);
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [openFilterField, setOpenFilterField] = useState<TextField | null>(null);
  const [filterDrafts, setFilterDrafts] = useState<Partial<Record<TextField, HeaderFilterDraft>>>({});
  const [activeFilters, setActiveFilters] = useState<Partial<Record<TextField, string[]>>>({});
  const [onlineSongs, setOnlineSongs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingNewRow, setIsSavingNewRow] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkReleaseDate, setBulkReleaseDate] = useState("");
  const createModalRef = useRef<HTMLDivElement | null>(null);
  const deleteModalRef = useRef<HTMLDivElement | null>(null);
  const uploadModalRef = useRef<HTMLDivElement | null>(null);

  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId) || null,
    [activeSheetId, sheets],
  );

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((current) => [...current.slice(-30), action]);
  }, []);

  const loadOnlineReferences = useCallback(async () => {
    const next = new Set<string>();

    const tryRead = async (url: string) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();

        const visit = (value: unknown) => {
          if (!value || typeof value !== "object") return;

          if (Array.isArray(value)) {
            value.forEach(visit);
            return;
          }

          const record = value as Record<string, unknown>;
          const statusValue = String(
            record.status || record.platform_status || record.platformStatus || "",
          ).toLowerCase();

          const isOnline =
            statusValue.includes("online") ||
            record.is_online === true ||
            record.online === true;

          const songValue = String(
            record.song || record.track || record.title || record.name || "",
          ).trim();

          if (isOnline && songValue) {
            next.add(songValue.toLowerCase());
          }

          Object.values(record).forEach((child) => {
            if (typeof child === "object") visit(child);
          });
        };

        visit(data);
      } catch {
        // Best-effort only.
      }
    };

    await Promise.all([
      tryRead(`${API_BASE_URL}/api/song-metrics`),
      tryRead(`${API_BASE_URL}/api/artist-library`),
      tryRead(`${API_BASE_URL}/api/my-artists`),
    ]);

    setOnlineSongs(next);
  }, []);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduling`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load scheduling rows.");
      }

      const data = (await response.json()) as SchedulingPayload | SchedulingRow[];
      if (Array.isArray(data)) {
        setSheets([{ id: 1, name: "Schedule", sort_order: 0 }]);
        setActiveSheetId(1);
        setRows(data.map((row) => ({ ...row, sheet_id: row.sheet_id || 1 })));
      } else {
        const sortedSheets = [...data.sheets].sort(
          (a, b) => a.sort_order - b.sort_order || a.id - b.id,
        );
        const latestSheet = sortedSheets[sortedSheets.length - 1] || null;

        setSheets(sortedSheets);
        setRows(data.rows);
        setActiveSheetId((current) => current || latestSheet?.id || null);
      }
    } catch {
      setError("Failed to load scheduling.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
    loadOnlineReferences();
  }, [loadOnlineReferences, loadRows]);

  useEffect(() => {
    if (activeSheet) {
      setSheetNameDraft(activeSheet.name);
    }
  }, [activeSheet]);

  useEffect(() => {
    if (!isCreateSheetOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        createModalRef.current &&
        !createModalRef.current.contains(event.target as Node)
      ) {
        setIsCreateSheetOpen(false);
        setNewSheetName("");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCreateSheetOpen(false);
        setNewSheetName("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateSheetOpen]);


  useEffect(() => {
    if (!openFilterField) return;

    const handleFilterClose = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFilterField(null);
      }
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-schedule-filter]")) {
        setOpenFilterField(null);
      }
    };

    document.addEventListener("keydown", handleFilterClose);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleFilterClose);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openFilterField]);


  useEffect(() => {
    if (!isDeleteSheetOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        deleteModalRef.current &&
        !deleteModalRef.current.contains(event.target as Node)
      ) {
        setIsDeleteSheetOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDeleteSheetOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleteSheetOpen]);

  useEffect(() => {
    if (!isUploadOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        uploadModalRef.current &&
        !uploadModalRef.current.contains(event.target as Node)
      ) {
        setIsUploadOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUploadOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUploadOpen]);

  const activeRows = useMemo(
    () => rows.filter((row) => row.sheet_id === activeSheetId),
    [activeSheetId, rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const searched = query
      ? activeRows.filter((row) =>
          [
            row.genre,
            row.status,
            row.artist,
            row.album,
            row.song,
            row.release_date,
            platformStatusForRow(row, onlineSongs),
            row.rn_account,
            row.remarks,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : activeRows;

    const filtered = searched.filter((row) => {
      return COLUMNS.every((column) => {
        const selectedValues = activeFilters[column.field];
        if (!selectedValues || selectedValues.length === 0) return true;

        const value =
          column.field === "platform_status"
            ? platformStatusForRow(row, onlineSongs)
            : String(row[column.field] || "");

        return selectedValues.includes(value || "(Blanks)");
      });
    });

    return [...filtered].sort((a, b) => {
      const aRaw =
        sortField === "platform_status"
          ? platformStatusForRow(a, onlineSongs)
          : String(a[sortField] || "");
      const bRaw =
        sortField === "platform_status"
          ? platformStatusForRow(b, onlineSongs)
          : String(b[sortField] || "");

      const result = aRaw.toLowerCase().localeCompare(bRaw.toLowerCase(), undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return sortDirection === "asc" ? result : -result;
    });
  }, [activeFilters, activeRows, onlineSongs, search, sortDirection, sortField]);

  const selectedRows = useMemo(() => {
    const selected = new Set(selectedIds);
    return rows.filter((row) => selected.has(row.id));
  }, [rows, selectedIds]);

  const handleSort = useCallback((field: SortField, direction?: "asc" | "desc") => {
    setSortField(field);
    setSortDirection((current) => {
      if (direction) return direction;
      return sortField === field && current === "asc" ? "desc" : "asc";
    });
  }, [sortField]);

  const updateRowLocal = useCallback(
    (rowId: number, field: TextField | "is_selected", value: string | boolean) => {
      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? {
                ...row,
                [field]: value,
              }
            : row,
        ),
      );
    },
    [],
  );

  const saveRowField = useCallback(
    async (
      row: SchedulingRow,
      field: TextField | "is_selected",
      value: string | boolean,
      shouldPushUndo = true,
    ) => {
      if (field === "platform_status") return;

      const nextValue = normalizeValue(value);
      const previousValue = row[field];

      if (previousValue === nextValue) return;

      updateRowLocal(row.id, field, nextValue);

      try {
        const response = await fetch(`${API_BASE_URL}/api/scheduling/rows/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field,
            value: nextValue,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save row.");
        }

        const saved = (await response.json()) as SchedulingRow;
        setRows((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );

        if (shouldPushUndo) {
          pushUndo({
            type: "edit",
            rowId: row.id,
            field,
            previousValue,
            nextValue,
          });
        }
      } catch {
        updateRowLocal(row.id, field, previousValue);
        setError("Failed to save scheduling row.");
      }
    },
    [pushUndo, updateRowLocal],
  );

  const handleTextBlur = useCallback(
    (row: SchedulingRow, field: TextField, value: string) => {
      saveRowField(row, field, value);
    },
    [saveRowField],
  );

  const handleKeyDownBlur = useCallback(
    (
      event:
        | React.KeyboardEvent<HTMLInputElement>
        | React.KeyboardEvent<HTMLSelectElement>,
    ) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    [],
  );

  const toggleSelection = useCallback(
    (row: SchedulingRow, visibleIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;

      setSelectedIds((current) => {
        if (event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
          const start = Math.min(lastSelectedIndex, visibleIndex);
          const end = Math.max(lastSelectedIndex, visibleIndex);
          const rangeIds = filteredRows.slice(start, end + 1).map((item) => item.id);
          const next = new Set(current);

          rangeIds.forEach((id) => {
            if (checked) {
              next.add(id);
            } else {
              next.delete(id);
            }
          });

          return Array.from(next);
        }

        const next = new Set(current);
        if (checked) {
          next.add(row.id);
        } else {
          next.delete(row.id);
        }
        return Array.from(next);
      });

      setLastSelectedIndex(visibleIndex);
    },
    [filteredRows, lastSelectedIndex],
  );

  const toggleAllVisible = useCallback(
    (checked: boolean) => {
      const visibleIds = filteredRows.map((row) => row.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        visibleIds.forEach((id) => {
          if (checked) {
            next.add(id);
          } else {
            next.delete(id);
          }
        });
        return Array.from(next);
      });
    },
    [filteredRows],
  );

  const createRow = useCallback(async () => {
    const hasValue = Object.entries(newRow).some(([key, value]) => {
      if (key === "is_selected") return false;
      return String(value || "").trim().length > 0;
    });

    if (!hasValue || isSavingNewRow || !activeSheetId) return;

    setIsSavingNewRow(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduling/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newRow, sheet_id: activeSheetId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create row.");
      }

      const created = (await response.json()) as SchedulingRow;
      setRows((current) => [created, ...current]);
      setNewRow(EMPTY_NEW_ROW);
      setShowNewRow(false);
      pushUndo({
        type: "create",
        row: created,
      });
    } catch {
      setError("Failed to create scheduling row.");
    } finally {
      setIsSavingNewRow(false);
    }
  }, [activeSheetId, isSavingNewRow, newRow, pushUndo]);

  const createSheet = useCallback(async () => {
    const name = newSheetName.trim();
    if (!name) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduling/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to create sheet.");
      }

      const sheet = (await response.json()) as SchedulingSheet;
      setSheets((current) => [...current, sheet]);
      setActiveSheetId(sheet.id);
      setNewSheetName("");
      setIsCreateSheetOpen(false);
      setSelectedIds([]);
    } catch {
      setError("Failed to create scheduling sheet.");
    }
  }, [newSheetName]);

  const renameSheet = useCallback(async () => {
    const name = sheetNameDraft.trim();
    if (!activeSheet || !name || name === activeSheet.name) {
      setEditingSheetName(false);
      setSheetNameDraft(activeSheet?.name || "");
      return;
    }

    const previousName = activeSheet.name;
    setSheets((current) =>
      current.map((sheet) =>
        sheet.id === activeSheet.id ? { ...sheet, name } : sheet,
      ),
    );
    setEditingSheetName(false);

    try {
      const renamePayload = JSON.stringify({ name });
      const requests = [
        {
          url: `${API_BASE_URL}/api/scheduling/sheets/${activeSheet.id}`,
          method: "PATCH",
        },
        {
          url: `${API_BASE_URL}/api/scheduling/sheets/${activeSheet.id}`,
          method: "PUT",
        },
        {
          url: `${API_BASE_URL}/api/scheduling/sheets/${activeSheet.id}/rename`,
          method: "POST",
        },
      ];

      let response: Response | null = null;
      for (const request of requests) {
        response = await fetch(request.url, {
          method: request.method,
          headers: { "Content-Type": "application/json" },
          body: renamePayload,
        });

        if (response.ok) break;
      }

      if (!response || !response.ok) {
        throw new Error("Failed to rename sheet.");
      }

      const saved = (await response.json()) as SchedulingSheet;
      setSheets((current) =>
        current.map((sheet) => (sheet.id === saved.id ? saved : sheet)),
      );

      pushUndo({
        type: "renameSheet",
        sheetId: activeSheet.id,
        previousName,
        nextName: name,
      });
    } catch {
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === activeSheet.id ? { ...sheet, name: previousName } : sheet,
        ),
      );
      setError("Failed to rename scheduling sheet.");
    }
  }, [activeSheet, pushUndo, sheetNameDraft]);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;

    const selected = selectedRows;
    setRows((current) => current.filter((row) => !selectedIds.includes(row.id)));
    setSelectedIds([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduling/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete rows.");
      }

      pushUndo({
        type: "delete",
        rows: selected,
      });
    } catch {
      setRows((current) =>
        [...selected, ...current].sort((a, b) => a.sort_order - b.sort_order),
      );
      setError("Failed to delete selected rows.");
    }
  }, [pushUndo, selectedIds, selectedRows]);

  const restoreRow = useCallback(async (row: SchedulingRow) => {
    const response = await fetch(`${API_BASE_URL}/api/scheduling/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheet_id: row.sheet_id,
        is_selected: row.is_selected,
        genre: row.genre,
        status: row.status,
        artist: row.artist,
        album: row.album,
        song: row.song,
        release_date: row.release_date,
        platform_status: row.platform_status,
        rn_account: row.rn_account,
        remarks: row.remarks,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to restore row.");
    }

    return (await response.json()) as SchedulingRow;
  }, []);

  const handleUndo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action || isUndoing) return;

    setIsUndoing(true);
    setError(null);

    try {
      if (action.type === "edit") {
        const row = rows.find((item) => item.id === action.rowId);
        if (row) {
          await saveRowField(row, action.field, action.previousValue, false);
        }
      }

      if (action.type === "create") {
        await fetch(`${API_BASE_URL}/api/scheduling/rows/${action.row.id}`, {
          method: "DELETE",
        });
        setRows((current) => current.filter((row) => row.id !== action.row.id));
      }

      if (action.type === "delete") {
        const restored = await Promise.all(action.rows.map(restoreRow));
        setRows((current) =>
          [...restored, ...current].sort((a, b) => a.sort_order - b.sort_order),
        );
      }

      if (action.type === "renameSheet") {
        await fetch(`${API_BASE_URL}/api/scheduling/sheets/${action.sheetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: action.previousName }),
        });
        setSheets((current) =>
          current.map((sheet) =>
            sheet.id === action.sheetId
              ? { ...sheet, name: action.previousName }
              : sheet,
          ),
        );
      }

      setUndoStack((current) => current.slice(0, -1));
    } catch {
      setError("Failed to undo the last action.");
    } finally {
      setIsUndoing(false);
    }
  }, [isUndoing, restoreRow, rows, saveRowField, undoStack]);

  useEffect(() => {
    const handleKeyboardUndo = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyboardUndo);
    return () => window.removeEventListener("keydown", handleKeyboardUndo);
  }, [handleUndo]);


  const applyBulkField = useCallback(
    async (field: "status" | "release_date", value: string) => {
      if (!value || selectedRows.length === 0) return;

      const previousRows = selectedRows.map((row) => ({ ...row }));

      setRows((current) =>
        current.map((row) =>
          selectedIds.includes(row.id)
            ? {
                ...row,
                [field]: value,
              }
            : row,
        ),
      );

      try {
        await Promise.all(
          selectedRows.map((row) =>
            fetch(`${API_BASE_URL}/api/scheduling/rows/${row.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                field,
                value,
              }),
            }),
          ),
        );

        pushUndo({
          type: "delete",
          rows: previousRows,
        });

        setBulkStatus("");
        setBulkReleaseDate("");
      } catch {
        setRows((current) =>
          current.map((row) => {
            const previous = previousRows.find((item) => item.id === row.id);
            return previous || row;
          }),
        );
        setError("Failed to update selected rows.");
      }
    },
    [pushUndo, selectedIds, selectedRows],
  );

  const visibleSelectedCount = filteredRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const uniqueValuesForField = useCallback(
    (field: TextField) => {
      const column = COLUMNS.find((item) => item.field === field);
      const values = activeRows.map((row) => {
        if (field === "platform_status") {
          return platformStatusForRow(row, onlineSongs) || "(Blanks)";
        }
        return String(row[field] || "") || "(Blanks)";
      });

      if (column?.type === "status") {
        const base = STATUS_OPTIONS.filter((status) => values.includes(status));
        const other = values.filter(
          (value) => !STATUS_OPTIONS.includes(value) && value !== "(Blanks)",
        );
        return [...base, ...Array.from(new Set(other)).sort(), "(Blanks)"].filter(
          (value, index, array) => array.indexOf(value) === index && values.includes(value),
        );
      }

      return Array.from(new Set(values)).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      );
    },
    [activeRows, onlineSongs],
  );

  const openHeaderFilter = useCallback(
    (field: TextField) => {
      const values = uniqueValuesForField(field);
      setFilterDrafts((current) => ({
        ...current,
        [field]: {
          query: "",
          selected: activeFilters[field] || values,
        },
      }));
      setOpenFilterField(field);
    },
    [activeFilters, uniqueValuesForField],
  );

  const HeaderFilterPopup = ({ column }: { column: Column }) => {
    if (openFilterField !== column.field) return null;

    const values = uniqueValuesForField(column.field);
    const draft = filterDrafts[column.field] || {
      query: "",
      selected: activeFilters[column.field] || values,
    };
    const visibleValues = values.filter((value) =>
      value.toLowerCase().includes(draft.query.toLowerCase()),
    );

    const updateDraftSelected = (selected: string[]) => {
      setFilterDrafts((current) => ({
        ...current,
        [column.field]: {
          ...draft,
          selected,
        },
      }));
    };

    return (
      <div
        data-schedule-filter
        className="absolute left-0 top-full z-50 mt-2 w-[260px] rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl shadow-black/70"
      >
        <button
          onClick={() => {
            handleSort(column.field, "asc");
            setOpenFilterField(null);
          }}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-white hover:bg-zinc-900"
        >
          Sort A to Z
        </button>
        <button
          onClick={() => {
            handleSort(column.field, "desc");
            setOpenFilterField(null);
          }}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-white hover:bg-zinc-900"
        >
          Sort Z to A
        </button>

        <div className="my-3 h-px bg-zinc-800" />

        <input
          value={draft.query}
          onChange={(event) =>
            setFilterDrafts((current) => ({
              ...current,
              [column.field]: {
                ...draft,
                query: event.target.value,
              },
            }))
          }
          placeholder="Search"
          className="mb-3 h-9 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
        />

        <div className="mb-2 flex gap-2">
          <button
            onClick={() => updateDraftSelected(values)}
            className="h-8 flex-1 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-200 hover:border-green-500"
          >
            Select all
          </button>
          <button
            onClick={() => updateDraftSelected([])}
            className="h-8 flex-1 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-200 hover:border-red-500"
          >
            Deselect all
          </button>
        </div>

        <div className="schedule-filter-scroll max-h-[300px] overflow-y-auto pr-1">
          {visibleValues.map((value) => {
            const checked = draft.selected.includes(value);

            return (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold text-white hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const nextSelected = checked
                      ? draft.selected.filter((item) => item !== value)
                      : [...draft.selected, value];
                    updateDraftSelected(nextSelected);
                  }}
                  className="h-4 w-4 rounded border-zinc-700 accent-green-500"
                />
                {value}
              </label>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end gap-2 border-t border-zinc-800 pt-3">
          <button
            onClick={() => {
              setActiveFilters((current) => {
                const next = { ...current };
                delete next[column.field];
                return next;
              });
              setOpenFilterField(null);
            }}
            className="h-9 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300 hover:border-zinc-600"
          >
            Clear
          </button>
          <button
            onClick={() => setOpenFilterField(null)}
            className="h-9 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300 hover:border-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setActiveFilters((current) => ({
                ...current,
                [column.field]: draft.selected,
              }));
              setOpenFilterField(null);
            }}
            className="h-9 rounded-lg bg-green-500 px-4 text-sm font-bold text-black hover:bg-green-400"
          >
            OK
          </button>
        </div>
      </div>
    );
  };




  const importCsvToCurrentSheet = useCallback(async () => {
    if (!uploadFile || !activeSheetId || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      const csvText = await uploadFile.text();
      const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error("CSV is empty.");
      }

      const parseLine = (line: string) => {
        const values: string[] = [];
        let current = "";
        let insideQuotes = false;

        for (let index = 0; index < line.length; index += 1) {
          const character = line[index];
          const nextCharacter = line[index + 1];

          if (character === '"' && insideQuotes && nextCharacter === '"') {
            current += '"';
            index += 1;
            continue;
          }

          if (character === '"') {
            insideQuotes = !insideQuotes;
            continue;
          }

          if (character === "," && !insideQuotes) {
            values.push(current.trim());
            current = "";
            continue;
          }

          current += character;
        }

        values.push(current.trim());
        return values;
      };

      const headers = parseLine(lines[0]).map((header) =>
        header.toLowerCase().replace(/[^a-z0-9]/g, ""),
      );

      const findIndex = (labels: string[]) =>
        headers.findIndex((header) =>
          labels.some((label) => header === label.toLowerCase().replace(/[^a-z0-9]/g, "")),
        );

      const indexes = {
        genre: findIndex(["genre"]),
        status: findIndex(["status"]),
        artist: findIndex(["artist"]),
        album: findIndex(["album"]),
        song: findIndex(["song"]),
        release_date: findIndex(["release date", "releasedate", "date"]),
        platform_status: findIndex(["platform status", "platformstatus"]),
        rn_account: findIndex(["rn account", "rnaccount", "account"]),
        remarks: findIndex(["remarks", "remark", "notes"]),
      };

      const createdRows: SchedulingRow[] = [];

      for (const line of lines.slice(1)) {
        const values = parseLine(line);
        const payload = {
          sheet_id: activeSheetId,
          is_selected: false,
          genre: indexes.genre >= 0 ? values[indexes.genre] || "" : "",
          status: indexes.status >= 0 ? values[indexes.status] || "" : "",
          artist: indexes.artist >= 0 ? values[indexes.artist] || "" : "",
          album: indexes.album >= 0 ? values[indexes.album] || "" : "",
          song: indexes.song >= 0 ? values[indexes.song] || "" : "",
          release_date: indexes.release_date >= 0 ? values[indexes.release_date] || "" : "",
          platform_status: indexes.platform_status >= 0 ? values[indexes.platform_status] || "" : "",
          rn_account: indexes.rn_account >= 0 ? values[indexes.rn_account] || "" : "",
          remarks: indexes.remarks >= 0 ? values[indexes.remarks] || "" : "",
        };

        const hasData = Object.entries(payload).some(([key, value]) => {
          if (key === "sheet_id" || key === "is_selected") return false;
          return String(value || "").trim().length > 0;
        });

        if (!hasData) continue;

        const response = await fetch(`${API_BASE_URL}/api/scheduling/rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to upload one or more rows.");
        }

        createdRows.push((await response.json()) as SchedulingRow);
      }

      setRows((current) => [...createdRows, ...current]);
      setUploadFile(null);
      setIsUploadOpen(false);
    } catch {
      setError("Failed to upload scheduling data.");
    } finally {
      setIsUploading(false);
    }
  }, [activeSheetId, isUploading, uploadFile]);

  const downloadCurrentSheetCsv = useCallback(() => {
    const header = COLUMNS.map((column) => column.label);
    const csvRows = activeRows.map((row) =>
      COLUMNS.map((column) => {
        const value =
          column.field === "platform_status"
            ? platformStatusForRow(row, onlineSongs)
            : String(row[column.field] || "");
        return `"${value.replace(/"/g, '""')}"`;
      }).join(","),
    );

    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSheet?.name || "schedule"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeRows, activeSheet?.name, onlineSongs]);

  const deleteCurrentSheet = useCallback(async () => {
    if (!activeSheet) return;

    const sheetRows = rows.filter((row) => row.sheet_id === activeSheet.id);
    const previousSheets = sheets;
    const previousRows = rows;
    const nextSheet = sheets.find((sheet) => sheet.id !== activeSheet.id);

    setRows((current) => current.filter((row) => row.sheet_id !== activeSheet.id));
    setSheets((current) => current.filter((sheet) => sheet.id !== activeSheet.id));
    setSelectedIds([]);
    setIsDeleteSheetOpen(false);
    setActiveSheetId(nextSheet?.id || null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/scheduling/sheets/${activeSheet.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("Failed to delete sheet.");
      }

      pushUndo({
        type: "delete",
        rows: sheetRows,
      });
      setError(null);
    } catch {
      setSheets(previousSheets);
      setRows(previousRows);
      setActiveSheetId(activeSheet.id);
      setError("Failed to delete scheduling sheet.");
    }
  }, [activeSheet, pushUndo, rows, sheets]);

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white lg:px-10">
      <style jsx global>{`
        .schedule-filter-scroll {
          scrollbar-width: thin;
          scrollbar-color: #10b981 #020617;
        }
        .schedule-filter-scroll::-webkit-scrollbar {
          width: 10px;
          display: block;
          background: #020617;
        }
        .schedule-filter-scroll::-webkit-scrollbar-track {
          background: #020617;
          border-radius: 999px;
        }
        .schedule-filter-scroll::-webkit-scrollbar-thumb {
          background: #10b981;
          border: 2px solid #020617;
          border-radius: 999px;
        }
        .schedule-status-select option {
          background: #020617;
          color: #ffffff;
        }
        .schedule-date-input {
          color-scheme: dark;
        }
        .schedule-date-input::-webkit-calendar-picker-indicator {
          filter: brightness(0) invert(1) !important;
          opacity: 1 !important;
          cursor: pointer;
        }
      `}</style>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Scheduling</h1>

        <div className="flex flex-wrap items-center gap-3">
          {undoStack.length > 0 ? (
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-lg font-bold text-zinc-200 hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60"
              title="Undo, or press Ctrl+Z"
            >
              <span className="inline-block rotate-90">↶</span>
            </button>
          ) : null}

          <select
            value={activeSheetId || ""}
            onChange={(event) => {
              setActiveSheetId(Number(event.target.value));
              setSelectedIds([]);
              setShowNewRow(false);
            }}
            className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-white outline-none focus:border-green-500"
          >
            {sheets.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsCreateSheetOpen(true)}
            className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 hover:border-green-500 hover:text-green-400"
          >
            Create
          </button>

          {selectedIds.length > 0 ? (
            <button
              onClick={deleteSelected}
              className="h-11 rounded-xl border border-red-500/70 bg-red-950/40 px-4 text-sm font-bold text-red-200 hover:bg-red-950"
            >
              Delete {selectedIds.length}
            </button>
          ) : null}

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search schedule..."
            className="h-11 w-[240px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
          />
          <button
            onClick={downloadCurrentSheetCsv}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-green-500 hover:text-green-400"
            title="Download sheet"
          >
            ↓
          </button>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-green-500 hover:text-green-400"
            title="Upload bulk data"
          >
            ↑
          </button>

          <button
            onClick={() => setIsDeleteSheetOpen(true)}
            disabled={!activeSheet}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/70 bg-red-950/30 text-red-300 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Delete sheet"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 16h10l1-16" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
          <span className="text-sm font-semibold text-white">
            {selectedIds.length} selected
          </span>

          <select
            value={bulkStatus}
            onChange={(event) => {
              setBulkStatus(event.target.value);
              applyBulkField("status", event.target.value);
            }}
            className={`schedule-status-select h-10 rounded-xl border border-zinc-800 bg-black px-3 text-sm font-bold outline-none focus:border-green-500 ${statusTextClass(
              bulkStatus,
            )}`}
          >
            <option value="">Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status} className={statusTextClass(status)}>
                {status}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={bulkReleaseDate}
            onChange={(event) => {
              setBulkReleaseDate(event.target.value);
              applyBulkField("release_date", event.target.value);
            }}
            className="h-10 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
            title="Release date"
          />

          <button
            onClick={() => setSelectedIds([])}
            className="h-10 rounded-xl border border-zinc-800 px-3 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
          >
            Deselect
          </button>
        </div>
      ) : null}

      {isCreateSheetOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div
            ref={createModalRef}
            className="w-[420px] max-w-[calc(100vw-32px)] rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black"
          >
            <h2 className="text-lg font-bold text-white">Create sheet</h2>
            <p className="mt-2 text-sm text-zinc-500">Add a new Scheduling table.</p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.13em] text-zinc-500">
              Sheet name
            </label>
            <input
              value={newSheetName}
              onChange={(event) => setNewSheetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createSheet();
                if (event.key === "Escape") {
                  setIsCreateSheetOpen(false);
                  setNewSheetName("");
                }
              }}
              placeholder="Example: Hooks"
              className="mt-2 h-11 w-full rounded-xl border border-green-500 bg-black px-4 text-sm text-white outline-none placeholder:text-zinc-600"
              autoFocus
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreateSheetOpen(false);
                  setNewSheetName("");
                }}
                className="h-11 rounded-xl border border-zinc-800 px-5 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={createSheet}
                className="h-11 rounded-xl bg-green-500 px-5 text-sm font-bold text-black hover:bg-green-400"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteSheetOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div
            ref={deleteModalRef}
            className="w-[420px] max-w-[calc(100vw-32px)] rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black"
          >
            <h2 className="text-lg font-bold text-white">Delete sheet</h2>
            <p className="mt-2 text-sm text-zinc-500">
              This will delete "{activeSheet?.name}" and all rows inside it.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteSheetOpen(false)}
                className="h-11 rounded-xl border border-zinc-800 px-5 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={deleteCurrentSheet}
                className="h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUploadOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div
            ref={uploadModalRef}
            className="w-[420px] max-w-[calc(100vw-32px)] rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black"
          >
            <h2 className="text-lg font-bold text-white">Upload data</h2>
            <p className="mt-2 text-sm text-zinc-500">Add rows in bulk to this Scheduling table.</p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.13em] text-zinc-500">
              CSV file
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-xl border border-green-500 bg-black p-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-500 file:px-3 file:py-2 file:text-sm file:font-bold file:text-black"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadFile(null);
                }}
                className="h-11 rounded-xl border border-zinc-800 px-5 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={importCsvToCurrentSheet}
                disabled={!uploadFile || isUploading}
                className="h-11 rounded-xl bg-green-500 px-5 text-sm font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-500/80 bg-red-950/20 p-5 text-sm font-semibold text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800/80 p-5">
          <div>
            {editingSheetName ? (
              <input
                value={sheetNameDraft}
                onChange={(event) => setSheetNameDraft(event.target.value)}
                onBlur={renameSheet}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    renameSheet();
                  }

                  if (event.key === "Escape") {
                    setEditingSheetName(false);
                    setSheetNameDraft(activeSheet?.name || "");
                  }
                }}
                className="h-10 rounded-xl border border-green-500 bg-black px-3 text-lg font-bold text-white outline-none"
                autoFocus
              />
            ) : (
              <h2
                onDoubleClick={() => setEditingSheetName(true)}
                className="cursor-text text-lg font-bold"
                title="Double click to rename sheet"
              >
                {activeSheet?.name || "Schedule"}
              </h2>
            )}
          </div>

          <button
            onClick={() => setShowNewRow((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-2xl font-bold text-black hover:bg-green-400"
            title="Add new entry"
          >
            +
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1600px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="border-b border-zinc-800/80 text-xs uppercase tracking-[0.13em] text-zinc-500">
                <th className="w-[56px] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filteredRows.length > 0 &&
                      visibleSelectedCount === filteredRows.length
                    }
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-700 accent-green-500"
                  />
                </th>

                {COLUMNS.map((column) => (
                  <th
                    key={column.field}
                    data-schedule-filter className={`${column.width} relative px-4 py-3`}
                  >
                    <button
                      onClick={() => openHeaderFilter(column.field)}
                      className="inline-flex items-center gap-2 hover:text-green-400"
                    >
                      {column.label}
                      <span className="text-zinc-600">
                        {sortField === column.field
                          ? sortDirection === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                      <span className="text-green-500">▾</span>
                    </button>
                    <HeaderFilterPopup column={column} />
                  </th>
                ))}

                <th className="w-[80px] px-4 py-3">Save</th>
              </tr>
            </thead>

            <tbody>
              {showNewRow ? (
                <tr className="border-b border-zinc-800 bg-black/60">
                  <td className="px-4 py-3 align-middle">
                    <span className="text-xs text-zinc-600">New</span>
                  </td>

                  {COLUMNS.map((column) => (
                    <td key={column.field} className="px-4 py-3 align-middle">
                      {column.type === "status" ? (
                        <select
                          value={newRow[column.field]}
                          onChange={(event) =>
                            setNewRow((current) => ({
                              ...current,
                              [column.field]: event.target.value,
                            }))
                          }
                          className={`schedule-status-select h-10 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm font-bold outline-none focus:border-green-500 ${statusTextClass(
                            newRow[column.field],
                          )}`}
                        >
                          <option value="">Status</option>
                          {STATUS_OPTIONS.map((status) => (
                            <option
                              key={status}
                              value={status}
                              className={statusTextClass(status)}
                            >
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : column.type === "date" ? (
                        <input
                          type="date"
                          value={formatDateForInput(newRow[column.field])}
                          onChange={(event) =>
                            setNewRow((current) => ({
                              ...current,
                              [column.field]: event.target.value,
                            }))
                          }
                          className="schedule-date-input h-10 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500 schedule-date-input [color-scheme:dark]"
                        />
                      ) : column.type === "platform" ? (
                        <StatusBadge value={platformStatusForRow(newRow as SchedulingRow, onlineSongs)} />
                      ) : (
                        <input
                          value={newRow[column.field]}
                          onChange={(event) =>
                            setNewRow((current) => ({
                              ...current,
                              [column.field]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              createRow();
                            }
                          }}
                          placeholder={column.label}
                          className="schedule-date-input h-10 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
                        />
                      )}
                    </td>
                  ))}

                  <td className="px-4 py-3 align-middle">
                    <button
                      onClick={createRow}
                      disabled={isSavingNewRow}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-lg font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                      title="Save new row"
                    >
                      ↵
                    </button>
                  </td>
                </tr>
              ) : null}

              {isLoading ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-6 py-12 text-center text-zinc-500">
                    Loading scheduling...
                  </td>
                </tr>
              ) : null}

              {!isLoading &&
                filteredRows.map((row, index) => {
                  const statusText = statusTextClass(row.status);

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-zinc-900 hover:bg-zinc-900/60 ${
                        selectedIds.includes(row.id) ? "bg-green-950/10" : ""
                      } ${statusText}`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={(event) => toggleSelection(row, index, event)}
                          className="h-4 w-4 rounded border-zinc-700 accent-green-500"
                        />
                      </td>

                      {COLUMNS.map((column) => (
                        <td key={column.field} className="px-4 py-3 align-middle">
                          {column.type === "status" ? (
                            <select
                              value={row[column.field] || ""}
                              onChange={(event) =>
                                saveRowField(row, column.field, event.target.value)
                              }
                              onKeyDown={handleKeyDownBlur}
                              className={`schedule-status-select h-9 w-full rounded-lg border border-transparent bg-black px-2 text-sm font-bold outline-none hover:border-zinc-800 focus:border-green-500 ${statusTextClass(
                                row[column.field],
                              )}`}
                            >
                              <option value="">-</option>
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          ) : column.type === "date" ? (
                            <input
                              type="date"
                              defaultValue={formatDateForInput(row[column.field])}
                              onBlur={(event) =>
                                handleTextBlur(row, column.field, event.target.value)
                              }
                              onKeyDown={handleKeyDownBlur}
                              className="schedule-date-input h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-white outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black schedule-date-input [color-scheme:dark]"
                            />
                          ) : column.type === "platform" ? (
                            <StatusBadge value={platformStatusForRow(row, onlineSongs)} />
                          ) : (
                            <input
                              defaultValue={row[column.field]}
                              onBlur={(event) =>
                                handleTextBlur(row, column.field, event.target.value)
                              }
                              onKeyDown={handleKeyDownBlur}
                              className={`h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:border-zinc-800 focus:border-green-500 focus:bg-black ${
                                column.field === "remarks" ? "min-w-[260px]" : ""
                              }`}
                            />
                          )}
                        </td>
                      ))}

                      <td className="px-4 py-3 align-middle text-zinc-700">—</td>
                    </tr>
                  );
                })}

              {!isLoading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-6 py-12 text-center text-zinc-500">
                    No scheduling entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
