"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAccounts } from "@/lib/api/accounts"
import { useActiveAccountStore } from "@/lib/store/activeAccount"

export default function AccountSwitcher() {
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  })

  const { activeAccountId, setActiveAccountId } = useActiveAccountStore()

  // 🔥 AUTO SELECT FIRST ACCOUNT
  useEffect(() => {
    if (!activeAccountId && data && data.length > 0) {
  setActiveAccountId(data[0].id)
}
  }, [data, activeAccountId, setActiveAccountId])

  const activeAccount = data?.find((acc: any) => acc.id === activeAccountId)

  if (isLoading) {
    return <div className="text-sm text-zinc-400">Loading...</div>
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={activeAccountId ?? ""}
        onChange={(e) => setActiveAccountId(Number(e.target.value))}
        className="bg-zinc-900 border border-zinc-700 text-white px-3 py-2 rounded text-sm"
      >
        {data?.map((acc: any) => (
          <option key={acc.id} value={acc.id}>
            {acc.display_name}
          </option>
        ))}
      </select>

      <div className="text-sm text-zinc-400">
        Active:{" "}
        <span className="text-white font-medium">
          {activeAccount?.display_name}
        </span>
      </div>
    </div>
  )
}