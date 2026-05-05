"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccounts } from "@/lib/api/accounts";

type Account = {
  id: number;
  display_name?: string;
  name?: string;
};

type CreateResult = {
  name?: string;
  account_name?: string;
  url?: string;
  tracks?: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

async function readResponse(res: Response) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 180) || "Invalid server response");
  }
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
  const [result, setResult] = useState<CreateResult | null>(null);
  const [loading, setLoading] = useState(false);

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

  const selectedAccount = accounts.find((a) => String(a.id) === accountId);

  const downloadTemplate = () => {
    const csv = "Account,Title,Description,Spotify_link_1,Spotify_link_2\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "playlist_template.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleCreate = async () => {
    try {
      setError("");
      setResult(null);
      setLoading(true);

      if (!accountId) throw new Error("Choose an account first.");
      if (!playlistName.trim()) throw new Error("Playlist name is required.");

      const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: Number(accountId),
          name: playlistName.trim(),
          description,
          import_url_1: link1,
          import_url_2: link2,
        }),
      });

      const data = await readResponse(res);

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Failed to create playlist.");
      }

      setResult({
        name: data?.name || data?.playlist?.name || playlistName,
        account_name:
          data?.account_name ||
          selectedAccount?.display_name ||
          selectedAccount?.name ||
          "—",
        url: data?.url || data?.spotify_url || data?.playlist?.spotify_url,
        tracks: data?.tracks || data?.tracks_count || data?.playlist?.tracks_count || 0,
      });
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulk = async () => {
    try {
      setError("");
      setResult(null);
      setLoading(true);

      if (!file) throw new Error("Choose a CSV file first.");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/playlists/bulk-create`, {
        method: "POST",
        body: form,
      });

      const data = await readResponse(res);

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Failed to upload CSV.");
      }

      setResult({
        name: data?.created?.[0]?.name || data?.name || "Bulk upload completed",
        account_name: data?.created?.[0]?.account_name || "Multiple",
        url: data?.created?.[0]?.url,
        tracks: data?.created?.[0]?.tracks || data?.tracks || 0,
      });
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
            Create one playlist or upload a CSV to create playlists in bulk.
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
                tab === "single"
                  ? "bg-green-500 text-black"
                  : "text-zinc-400 hover:text-white"
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
                tab === "bulk"
                  ? "bg-green-500 text-black"
                  : "text-zinc-400 hover:text-white"
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
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Account
                </div>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm text-white outline-none focus:border-green-500"
                >
                  <option value="">Select account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.display_name || acc.name || `Account ${acc.id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Playlist Name
                </div>
                <input
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="Playlist name"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm outline-none focus:border-green-500"
                />
              </label>

              <label className="col-span-2">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Description
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </label>

              <label className="col-span-2">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Import Tracks Optional 1
                </div>
                <input
                  value={link1}
                  onChange={(e) => setLink1(e.target.value)}
                  placeholder="Spotify playlist URL to copy tracks from"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-black px-4 text-sm outline-none focus:border-green-500"
                />
              </label>

              <label className="col-span-2">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Import Tracks Optional 2
                </div>
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
                Use the template format: Account, Title, Description, Spotify links.
              </p>

              <label className="mx-auto mt-7 block h-12 w-full max-w-[760px] cursor-pointer rounded-xl border border-zinc-700 bg-black px-4 text-left text-sm leading-[48px] text-green-400 hover:border-green-500">
                {file ? file.name : "Choose File"}
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

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
          <h2 className="text-lg font-bold">Results</h2>

          <div className="mt-5 grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Playlist Name
              </p>
              <p className="mt-3 text-sm">{result?.name || "—"}</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Account Name
              </p>
              <p className="mt-3 text-sm">{result?.account_name || "—"}</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Link
              </p>
              {result?.url ? (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block text-sm text-green-400"
                >
                  Open
                </a>
              ) : (
                <p className="mt-3 text-sm">—</p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Tracks
              </p>
              <p className="mt-3 text-sm">{result?.tracks ?? "—"}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}