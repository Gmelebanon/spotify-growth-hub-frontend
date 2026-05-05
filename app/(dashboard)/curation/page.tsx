"use client";

import { useEffect, useState } from "react";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type SavedCuration = {
  id: string;
  curation_name: string;
  created_at: string;
  account_id: number | null;
  target: string | null;
};

export default function CurationPage() {
  const activeAccountId = useActiveAccountStore(
    (state) => state.activeAccountId
  );

  const [savedCurations, setSavedCurations] = useState<SavedCuration[]>([]);
  const [curationName, setCurationName] = useState("");

  // ✅ load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("savedCurations");
    if (!raw) return;

    const items = JSON.parse(raw);
    setSavedCurations(items);
  }, []);

  // ✅ save
  const handleSave = () => {
    const newItem: SavedCuration = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      account_id: activeAccountId || null,
      curation_name: curationName || "Curation Draft",
      target: null,
    };

    const next = [newItem, ...savedCurations];
    setSavedCurations(next);
    localStorage.setItem("savedCurations", JSON.stringify(next));
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Curation</h1>

      {/* SAVE */}
      <div className="border border-zinc-800 rounded-xl p-4 mb-6 max-w-xl">
        <h2 className="mb-4 font-semibold">Save and Send</h2>

        <input
          value={curationName}
          onChange={(e) => setCurationName(e.target.value)}
          placeholder="Curation name"
          className="w-full mb-3 bg-black border border-zinc-700 px-3 py-2 rounded"
        />

        <button
          onClick={handleSave}
          className="bg-green-500 text-black px-4 py-2 rounded"
        >
          Save
        </button>
      </div>

      {/* LIST */}
      <div className="border border-zinc-800 rounded-xl p-4 max-w-xl">
        <h2 className="mb-4 font-semibold">Saved Curations</h2>

        {savedCurations.length === 0 && (
          <p className="text-zinc-500">No saved curations</p>
        )}

        {savedCurations.map((item) => (
          <div
            key={item.id}
            className="border border-zinc-700 p-3 rounded mb-2"
          >
            <div className="font-medium">{item.curation_name}</div>
            <div className="text-xs text-zinc-500">
              {new Date(item.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}