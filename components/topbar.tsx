"use client"

import AccountSwitcher from "@/components/account-switcher"

export default function Topbar() {
  return (
    <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6">
      <p className="text-lg font-semibold">Spotify Growth Hub</p>

      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            window.location.href = "http://127.0.0.1:8000/auth/login"
          }}
          className="bg-green-500 text-black px-3 py-1 rounded text-sm font-medium"
        >
          Connect
        </button>

        <AccountSwitcher />
      </div>
    </div>
  )
}