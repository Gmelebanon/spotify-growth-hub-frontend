"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccounts } from "@/lib/api/accounts";

type Account = {
  id: number;
  display_name?: string;
  name?: string;
};

type PlaylistRow = {
  account_id: number;
  name: string;
  description?: string;
  folder_name?: string;
  import_url_1?: string;
  import_url_2?: string;
  import_urls?: string[];
  source_playlist_url?: string;
  source_playlist_urls?: string[];
  source_playlist_ids?: string[];
  copy_tracks_from_url?: string;
  copy_tracks_from_urls?: string[];
  import_from_playlist_url?: string;
  import_playlist_urls?: string[];
  track_source_urls?: string[];
  spotify_source_playlist_ids?: string[];
  source_playlist_url_1?: string;
  source_playlist_url_2?: string;
  tracks_url_1?: string;
  tracks_url_2?: string;
  link_1?: string;
  link_2?: string;
};

type CreateResult = {
  name?: string;
  account_name?: string;
  account_id?: number;
  folder_name?: string;
  url?: string;
  tracks?: number;
  status?: string;
  error?: string;
  import_url_1?: string;
  import_url_2?: string;
};

const CREATE_ACTION_COOLDOWN_MS = 10_000;

function getCooldownMessage(lastCreatedAt: number) {
  const elapsed = Date.now() - lastCreatedAt;
  const remaining = Math.ceil((CREATE_ACTION_COOLDOWN_MS - elapsed) / 1000);
  return `Please wait ${remaining} more second${remaining === 1 ? "" : "s"} before starting another playlist creation.`;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

function formatApiError(data: any, fallback: string) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item: any) => {
        const location = Array.isArray(item?.loc) ? item.loc.join(" → ") : "request";
        return item?.msg ? `${location}: ${item.msg}` : JSON.stringify(item);
      })
      .join(" | ");
  }

  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail) return JSON.stringify(data.detail);
  return fallback;
}

async function readResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 240) || "Invalid server response");
  }
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function csvEscape(value: any) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function accountLabel(account?: Account) {
  if (!account) return "—";
  return account.display_name || account.name || `Account ${account.id}`;
}

function splitUrls(value: string) {
  return value
    .split(/[\n|;]+|,\s*(?=https?:\/\/|spotify:)/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSpotifyPlaylistId(url: string) {
  const trimmed = url.trim();
  const spotifyUri = trimmed.match(/spotify:playlist:([A-Za-z0-9]+)/i);
  if (spotifyUri?.[1]) return spotifyUri[1];

  const webUrl = trimmed.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  if (webUrl?.[1]) return webUrl[1];

  return "";
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePlaylistRow(
  row: Record<string, string>,
  selectedAccountId: string,
  accounts: Account[],
  defaultFolderName: string
): PlaylistRow {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  const accountValue = pick("account_id", "accountid", "account", "account_name", "spotify_account", "profile");
  const matchedAccount = accounts.find((account) => {
    const label = String(account.display_name || account.name || `Account ${account.id}`).trim();
    return label.toLowerCase() === accountValue.toLowerCase();
  });

  const resolvedAccountId =
    accountValue && /^\d+$/.test(accountValue)
      ? Number(accountValue)
      : matchedAccount?.id || (selectedAccountId ? Number(selectedAccountId) : undefined);

  const firstUrlCell = pick(
    "import_url_1",
    "source_playlist_url_1",
    "source_url_1",
    "tracks_url_1",
    "spotify_link_1",
    "spotify_url_1",
    "playlist_link_1",
    "playlist_url_1",
    "copy_tracks_from_url_1",
    "copy_from_playlist_1",
    "link_1",
    "url_1",
    "link",
    "url",
    "spotify_link",
    "spotify_url",
    "playlist_link",
    "playlist_url",
    "tracks_link",
    "tracks_url",
    "import_url",
    "source_playlist_url",
    "copy_tracks_from_url",
    "copy_from_playlist",
    "import_from_playlist_url"
  );

  const secondUrlCell = pick(
    "import_url_2",
    "source_playlist_url_2",
    "source_url_2",
    "tracks_url_2",
    "spotify_link_2",
    "spotify_url_2",
    "playlist_link_2",
    "playlist_url_2",
    "copy_tracks_from_url_2",
    "copy_from_playlist_2",
    "link_2",
    "url_2"
  );

  const importUrls = uniqueNonEmpty([...splitUrls(firstUrlCell), ...splitUrls(secondUrlCell)]);
  const importUrl1 = importUrls[0] || "";
  const importUrl2 = importUrls[1] || "";
  const playlistIds = uniqueNonEmpty(importUrls.map(extractSpotifyPlaylistId));

  const folderName = pick("folder_name", "folder", "folder_title", "folder_id", "playlist_folder") || defaultFolderName.trim();

  return {
    account_id: resolvedAccountId as number,
    name: pick("name", "playlist_name", "playlist", "title"),
    description: pick("description", "desc"),
    folder_name: folderName || undefined,
    import_url_1: importUrl1 || undefined,
    import_url_2: importUrl2 || undefined,
    import_urls: importUrls,
    source_playlist_url: importUrl1 || undefined,
    source_playlist_urls: importUrls,
    source_playlist_ids: playlistIds,
    copy_tracks_from_url: importUrl1 || undefined,
    copy_tracks_from_urls: importUrls,
    import_from_playlist_url: importUrl1 || undefined,
    import_playlist_urls: importUrls,
    track_source_urls: importUrls,
    spotify_source_playlist_ids: playlistIds,
    source_playlist_url_1: importUrl1 || undefined,
    source_playlist_url_2: importUrl2 || undefined,
    tracks_url_1: importUrl1 || undefined,
    tracks_url_2: importUrl2 || undefined,
    link_1: importUrl1 || undefined,
    link_2: importUrl2 || undefined,
  };
}

function parseCsvRows(
  csvText: string,
  selectedAccountId: string,
  accounts: Account[],
  defaultFolderName: string
) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one playlist row.");
  }

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((values, rowIndex) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) item[header] = values[index]?.trim() || "";
    });

    const normalized = normalizePlaylistRow(item, selectedAccountId, accounts, defaultFolderName);

    if (!normalized.account_id) {
      throw new Error(`Row ${rowIndex + 2}: account_id is required. Add an Account ID column, use a matching account name, or select an account before uploading.`);
    }

    if (!normalized.name) {
      throw new Error(`Row ${rowIndex + 2}: playlist name is required. Use a Name, Playlist Name, Playlist, or Title column.`);
    }

    return normalized;
  });
}

function normalizeResults(data: any, fallbackRows: PlaylistRow[], accounts: Account[]): CreateResult[] {
  const candidates =
    data?.results ||
    data?.created ||
    data?.playlists ||
    data?.items ||
    data?.data ||
    (Array.isArray(data) ? data : null);

  if (Array.isArray(candidates) && candidates.length) {
    return candidates.map((item: any, index: number) => {
      const fallback = fallbackRows[index];
      const account = accounts.find((acc) => acc.id === Number(item?.account_id || fallback?.account_id));
      const playlist = item?.playlist || item;
      return {
        name: playlist?.name || item?.name || fallback?.name || `Playlist ${index + 1}`,
        account_id: Number(item?.account_id || fallback?.account_id) || undefined,
        account_name: item?.account_name || playlist?.account_name || accountLabel(account),
        folder_name: item?.folder_name || playlist?.folder_name || fallback?.folder_name,
        url: item?.url || item?.spotify_url || playlist?.url || playlist?.spotify_url || playlist?.external_url,
        tracks:
          item?.tracks ??
          item?.tracks_count ??
          item?.track_count ??
          playlist?.tracks_count ??
          playlist?.track_count ??
          0,
        status: item?.status || (item?.error ? "Failed" : "Created"),
        error: item?.error || item?.message,
        import_url_1: fallback?.import_url_1,
        import_url_2: fallback?.import_url_2,
      };
    });
  }

  if (fallbackRows.length) {
    return fallbackRows.map((row) => {
      const account = accounts.find((acc) => acc.id === Number(row.account_id));
      return {
        name: row.name,
        account_id: row.account_id,
        account_name: accountLabel(account),
        folder_name: row.folder_name,
        tracks: 0,
        status: "Submitted",
        import_url_1: row.import_url_1,
        import_url_2: row.import_url_2,
      };
    });
  }

  return [
    {
      name: data?.name || data?.playlist?.name || "Playlist created",
      account_name: data?.account_name || "—",
      url: data?.url || data?.spotify_url || data?.playlist?.spotify_url,
      tracks: data?.tracks || data?.tracks_count || data?.playlist?.tracks_count || 0,
      status: "Created",
    },
  ];
}

export default function CreatePlaylistPage() {
  const [tab, setTab] = useState<"single" | "bulk">("single");

  const [accountId, setAccountId] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [description, setDescription] = useState("");
  const [link1, setLink1] = useState("");
  const [link2, setLink2] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CreateResult[]>([]);
  const [uploadedRows, setUploadedRows] = useState<PlaylistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const lastCreateActionAtRef = useRef(0);

  const accountsQuery = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const accounts = useMemo(() => {
    const data: any = accountsQuery.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.accounts)) return data.accounts;
    return [];
  }, [accountsQuery.data]);

  const selectedAccount = accounts.find((a: Account) => String(a.id) === accountId);

  const downloadTemplate = () => {
    const csv = "account_id,name,description,folder_name,source_playlist_url,source_playlist_url_2\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playlist_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadUploadedData = () => {
    const source = results.length ? results : uploadedRows;
    if (!source.length) return;

    const headers = [
      "account_id",
      "account_name",
      "name",
      "description",
      "folder_name",
      "import_url_1",
      "import_url_2",
      "playlist_url",
      "tracks",
      "status",
      "error",
    ];

    const csv = [
      headers.join(","),
      ...source.map((item: any) =>
        headers
          .map((header) => {
            if (header === "playlist_url") return csvEscape(item.url);
            return csvEscape(item[header]);
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_playlist_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreate = async () => {
    try {
      setError("");
      setResults([]);

      if (Date.now() - lastCreateActionAtRef.current < CREATE_ACTION_COOLDOWN_MS) {
        throw new Error(getCooldownMessage(lastCreateActionAtRef.current));
      }

      setLoading(true);
      if (!accountId) throw new Error("Choose an account first.");
      if (!playlistName.trim()) throw new Error("Playlist name is required.");

      const row: PlaylistRow = {
        account_id: Number(accountId),
        name: playlistName.trim(),
        description,
        import_url_1: link1.trim() || undefined,
        import_url_2: link2.trim() || undefined,
        import_urls: uniqueNonEmpty([link1.trim(), link2.trim()]),
        source_playlist_url: link1.trim() || undefined,
        source_playlist_urls: uniqueNonEmpty([link1.trim(), link2.trim()]),
        source_playlist_ids: uniqueNonEmpty([link1.trim(), link2.trim()].map(extractSpotifyPlaylistId)),
        copy_tracks_from_url: link1.trim() || undefined,
        copy_tracks_from_urls: uniqueNonEmpty([link1.trim(), link2.trim()]),
        import_from_playlist_url: link1.trim() || undefined,
        import_playlist_urls: uniqueNonEmpty([link1.trim(), link2.trim()]),
        track_source_urls: uniqueNonEmpty([link1.trim(), link2.trim()]),
        spotify_source_playlist_ids: uniqueNonEmpty([link1.trim(), link2.trim()].map(extractSpotifyPlaylistId)),
        source_playlist_url_1: link1.trim() || undefined,
        source_playlist_url_2: link2.trim() || undefined,
        tracks_url_1: link1.trim() || undefined,
        tracks_url_2: link2.trim() || undefined,
        link_1: link1.trim() || undefined,
        link_2: link2.trim() || undefined,
      };

      const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });

      const data = await readResponse(res);
      if (!res.ok) throw new Error(formatApiError(data, "Failed to create playlist."));

      lastCreateActionAtRef.current = Date.now();
      setResults(normalizeResults(data, [row], accounts));
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulk = async () => {
    try {
      setError("");
      setResults([]);
      setUploadedRows([]);

      if (Date.now() - lastCreateActionAtRef.current < CREATE_ACTION_COOLDOWN_MS) {
        throw new Error(getCooldownMessage(lastCreateActionAtRef.current));
      }

      setLoading(true);
      if (!file) throw new Error("Choose a CSV file first.");

      const csvText = await file.text();
      const rows = parseCsvRows(csvText, accountId, accounts, "");
      setUploadedRows(rows);

      const res = await fetch(`${API_BASE_URL}/api/playlists/bulk-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await readResponse(res);
      if (!res.ok) throw new Error(formatApiError(data, "Failed to upload CSV."));

      lastCreateActionAtRef.current = Date.now();
      setResults(normalizeResults(data, rows, accounts));
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-8 py-7 text-white">
      <div className="max-w-[1180px]">
        <Link href="/playlists" className="text-sm text-zinc-400 hover:text-white">
          ← Back to Playlists
        </Link>

        <div className="mt-5">
          <h1 className="text-3xl font-bold tracking-tight">Create Playlists</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create one playlist or upload a CSV to create playlists in bulk. Actions are spaced to reduce rate-limit risk.
          </p>
        </div>

        <div className="mt-7 flex items-center justify-between">
          <div className="flex w-fit gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => {
                setTab("single");
                setError("");
              }}
              className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                tab === "single" ? "bg-green-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Create Playlist
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("bulk");
                setError("");
              }}
              className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                tab === "bulk" ? "bg-green-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Bulk Upload
            </button>
          </div>

          {tab === "bulk" && (
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl border border-zinc-800 px-5 py-2 text-sm text-white hover:border-green-500 hover:text-green-400"
            >
              Download CSV Template
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-700 bg-red-950/40 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {tab === "single" && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="grid grid-cols-2 gap-5">
              <label>
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Account</div>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm text-white outline-none focus:border-green-500"
                >
                  <option value="">Select account</option>
                  {accounts.map((acc: Account) => (
                    <option key={acc.id} value={acc.id}>
                      {accountLabel(acc)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Playlist Name</div>
                <input
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="Playlist name"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm outline-none focus:border-green-500"
                />
              </label>

              <label className="col-span-2">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </label>

              <label className="col-span-2">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Import Tracks URL 1</div>
                <input
                  value={link1}
                  onChange={(e) => setLink1(e.target.value)}
                  placeholder="Spotify playlist URL to copy tracks from"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm outline-none focus:border-green-500"
                />
              </label>

              <label className="col-span-2">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Import Tracks URL 2</div>
                <input
                  value={link2}
                  onChange={(e) => setLink2(e.target.value)}
                  placeholder="Second Spotify playlist URL"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm outline-none focus:border-green-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="rounded-xl bg-green-500 px-10 py-3 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </section>
        )}

        {tab === "bulk" && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-black p-10 text-center">
              <h2 className="text-lg font-bold">Upload CSV file</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Use columns: account_id, name, description, folder_name, source_playlist_url, source_playlist_url_2. The source playlist URLs are sent as copy-track sources.
              </p>

              <div className="mx-auto mt-7 grid w-full max-w-[760px] gap-4 text-left">
                <label>
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Default Account Optional</div>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="">Choose Account</option>
                    {accounts.map((acc: Account) => (
                      <option key={acc.id} value={acc.id}>
                        {accountLabel(acc)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block h-12 w-full cursor-pointer rounded-xl border border-zinc-700 bg-black px-4 text-left text-sm leading-[48px] text-green-400 hover:border-green-500">
                  {file ? file.name : "Choose File"}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleBulk}
                disabled={loading}
                className="mt-7 rounded-xl bg-green-500 px-10 py-3 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-60"
              >
                {loading ? "Uploading..." : "Upload & Create"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Results</h2>
            {(results.length > 0 || uploadedRows.length > 0) && (
              <button
                type="button"
                onClick={downloadUploadedData}
                className="rounded-xl border border-zinc-800 px-5 py-2 text-sm text-white hover:border-green-500 hover:text-green-400"
              >
                Download Results CSV
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="mt-5 grid grid-cols-4 gap-4">
              {["Playlist Name", "Account Name", "Link", "Tracks"].map((label) => (
                <div key={label} className="rounded-xl border border-zinc-800 bg-black p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                  <p className="mt-3 text-sm">—</p>
                </div>
              ))}
            </div>
          ) : (
            <>
            <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-black text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Playlist</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Folder</th>
                    <th className="px-4 py-3">Tracks</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Link</th>
                    <th className="px-4 py-3">Import URLs</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((item, index) => (
                    <tr key={`${item.name}-${index}`} className="border-t border-zinc-800 bg-zinc-950/70">
                      <td className="px-4 py-3 font-medium text-white">{item.name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{item.account_name || item.account_id || "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{item.folder_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{item.tracks ?? "—"}</td>
                      <td className={item.error ? "px-4 py-3 text-red-300" : "px-4 py-3 text-green-400"}>
                        {item.error || item.status || "Created"}
                      </td>
                      <td className="px-4 py-3">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                            Open
                          </a>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-zinc-400" title={[item.import_url_1, item.import_url_2].filter(Boolean).join(" | ")}>
                        {[item.import_url_1, item.import_url_2].filter(Boolean).join(" | ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              {results.some((item) => Number(item.tracks || 0) === 0 && (item.import_url_1 || item.import_url_2)) && (
                <p className="mt-4 rounded-xl border border-yellow-900/60 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
                  The playlist was created, but the backend returned 0 tracks. This page is now sending the source playlist URLs with multiple copy-track field names. If tracks still stay at 0, the backend endpoint needs to read those fields, fetch tracks from the source Spotify playlist, and add them to the new playlist.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
