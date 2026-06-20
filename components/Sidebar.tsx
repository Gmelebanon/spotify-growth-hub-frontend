"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function SpotifyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 1.8C6.37 1.8 1.8 6.37 1.8 12S6.37 22.2 12 22.2 22.2 17.63 22.2 12 17.63 1.8 12 1.8Zm4.68 14.72a.76.76 0 0 1-1.04.25c-2.86-1.75-6.46-2.15-10.7-1.18a.76.76 0 1 1-.34-1.48c4.64-1.06 8.62-.6 11.83 1.36.36.22.47.69.25 1.05Zm1.25-2.78a.95.95 0 0 1-1.3.31c-3.27-2.01-8.25-2.59-12.11-1.42a.95.95 0 1 1-.55-1.82c4.41-1.34 9.9-.69 13.65 1.61.45.28.59.87.31 1.32Zm.1-2.9C14.1 8.51 7.62 8.3 3.9 9.43a1.14 1.14 0 1 1-.66-2.18c4.27-1.3 11.44-1.05 15.96 1.63a1.14 1.14 0 1 1-1.17 1.96Z" />
    </svg>
  );
}

const primaryNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "My Artists", href: "/my-artists", icon: "♪" },
  { label: "Daily Growth", href: "/playlists", icon: "≡" },
  { label: "Social Trends", href: "/trends", icon: "↗" },
  { label: "Google Trends", href: "/trends/google", icon: "⌕" },
  { label: "Playlist Manager", href: "/playlist-manager", icon: "▤" },
  { label: "Curation", href: "/curation", icon: "◇" },
];

const middleNavItems = [
  { label: "Playlists", href: "/ads", icon: "◉" },
  { label: "Production", href: "/production", icon: "▷" },
  { label: "Mashups", href: "/mashups", icon: "◫" },
  { label: "Releases", href: "/scheduling", icon: "◌" },
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
  icon: ReactNode;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === href ||
    (href !== "/trends" && pathname.startsWith(`${href}/`));

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
