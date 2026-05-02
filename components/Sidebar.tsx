"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNavItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Playlists", href: "/playlists" },
  { label: "Playlist Manager", href: "/playlist-manager" },
  { label: "Curation", href: "/curation" },

  // ✅ NEW TABS
  { label: "Ads", href: "/ads" },
  { label: "Production", href: "/production" },
];

const secondaryNavItems = [
  { label: "Song Metrics", href: "/song-metrics" },
  { label: "Trades", href: "/trades" },
  { label: "AI", href: "/ai" },
  { label: "Settings", href: "/settings" },
];

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-3 transition ${
        isActive
          ? "bg-zinc-900 text-green-400"
          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
    </Link>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-green-500/30" />;
}

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-[240px] flex-col border-r border-zinc-900 bg-black px-4 py-8">
      <div className="mb-8 px-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Nerd Engine
        </h1>
      </div>

      <nav className="flex flex-col">
        {/* PRIMARY */}
        <div className="flex flex-col gap-2">
          {primaryNavItems.slice(0, 4).map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </div>

        <Divider />

        {/* ADS + PRODUCTION */}
        <div className="flex flex-col gap-2">
          <NavLink href="/ads" label="Ads" />
          <NavLink href="/production" label="Production" />
        </div>

        {/* ✅ GREEN DIVIDER UNDER PRODUCTION */}
        <Divider />

        {/* SECONDARY */}
        <div className="flex flex-col gap-2">
          {secondaryNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </div>
      </nav>
    </aside>
  );
}