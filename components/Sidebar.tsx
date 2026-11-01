"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navSections = [
  [{ label: "Dashboard", href: "/dashboard", icon: "▦" }],
  [{ label: "Playlists", href: "/ads", icon: "◉" }, { label: "Playlists Daily", href: "/playlists", icon: "≡" }],
  [{ label: "Releases", href: "/scheduling", icon: "◌" }, { label: "My Artists", href: "/my-artists", icon: "♪" }],
  [{ label: "Curation", href: "/curation", icon: "◇" }, { label: "Playlist Manager", href: "/playlist-manager", icon: "▤" }],
  [{ label: "Production", href: "/production", icon: "▷" }, { label: "Mashups", href: "/mashups", icon: "◫" }],
  [{ label: "Song Trends", href: "/trends", icon: "↗" }, { label: "Keyword Trends", href: "/trends/google", icon: "⌕" }],
  [{ label: "AI", href: "/ai", icon: "✦" }, { label: "Trades", href: "/trades", icon: "↔" }, { label: "Song Metrics", href: "/song-metrics", icon: "⌁" }],
  [{ label: "Settings", href: "/settings", icon: "⚙" }],
];

function NavLink({ href, label, icon, collapsed }: { href: string; label: string; icon: ReactNode; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/trends" && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} title={collapsed ? label : undefined}
      className={`flex items-center rounded-xl transition-colors ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"} ${isActive ? "bg-zinc-900 text-green-400" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none text-current">{icon}</span>
      {!collapsed && <span className="whitespace-nowrap text-sm font-semibold leading-none">{label}</span>}
    </Link>
  );
}

function Divider() { return <div className="my-4 h-px bg-green-500/40" />; }

export default function Sidebar() {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const collapsed = !(hovered || pinned);

  return (
    <div className="relative hidden w-[72px] shrink-0 self-stretch lg:block" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <aside
        data-sidebar-scroll-hidden className={`sticky top-0 z-40 flex h-dvh flex-col overflow-x-hidden overflow-y-auto border-r border-zinc-900 bg-black px-3 py-7 transition-[width] duration-300 ease-in-out ${collapsed ? "w-[72px]" : "w-[210px]"}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`aside[data-sidebar-scroll-hidden]::-webkit-scrollbar { display: none; width: 0; height: 0; }`}</style>
        <div className={`mb-8 flex shrink-0 items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
          {!collapsed && <h1 className="whitespace-nowrap text-[18px] font-semibold tracking-tight text-white">Nerd Engine</h1>}
          <button type="button" onClick={() => setPinned(v => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"} aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}>
            {pinned ? "←" : "→"}
          </button>
        </div>
        <nav className="flex flex-col">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {sectionIndex > 0 && <Divider />}
              <div className="flex flex-col gap-2">
                {section.map(item => <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} collapsed={collapsed} />)}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
