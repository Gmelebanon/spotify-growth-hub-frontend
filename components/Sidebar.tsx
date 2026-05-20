"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "My Artists", href: "/my-artists", icon: "♪" },
  { label: "Daily Growth", href: "/playlists", icon: "≡" },
  { label: "Playlist Manager", href: "/playlist-manager", icon: "▤" },
  { label: "Curation", href: "/curation", icon: "◇" },
];

const middleNavItems = [
  { label: "Playlists", href: "/ads", icon: "◉" },
  { label: "Production", href: "/production", icon: "▷" },
];

const secondaryNavItems = [
  { label: "Song Metrics", href: "/song-metrics", icon: "⌁" },
  { label: "Trades", href: "/trades", icon: "↔" },
  { label: "AI", href: "/ai", icon: "✦" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

function NavLink({
  href,
  label,
  icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center rounded-xl transition ${
        collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"
      } ${
        isActive
          ? "bg-zinc-900 text-green-400"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center text-base leading-none text-current">
        {icon}
      </span>

      {!collapsed && (
        <span className="text-sm font-semibold leading-none">{label}</span>
      )}
    </Link>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-green-500/40" />;
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      className={`flex min-h-screen flex-col border-r border-zinc-900 bg-black py-7 transition-all duration-300 ${
        collapsed ? "w-[72px] px-3" : "w-[210px] px-3"
      }`}
    >
      <div
        className={`mb-8 flex items-center ${
          collapsed ? "justify-center" : "justify-between px-2"
        }`}
      >
        {!collapsed && (
          <h1 className="text-[18px] font-semibold tracking-tight text-white">
            Nerd Engine
          </h1>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav className="flex flex-col">
        <div className="flex flex-col gap-2">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </div>

        <Divider />

        <div className="flex flex-col gap-2">
          {middleNavItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </div>

        <Divider />

        <div className="flex flex-col gap-2">
          {secondaryNavItems.map((item) => (
            <div key={item.href}>
              {item.label === "Settings" && <Divider />}
              <NavLink
                href={item.href}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
              />
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}