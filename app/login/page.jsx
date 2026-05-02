"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, loginUser } from "@/lib/simpleAuth";

const releases = [
  ["01.jpg", "Synora", "432 Hz Awareness"],
  ["02.jpg", "Jaxen", "Blank Space"],
  ["03.jpg", "Sheri Sky", "Bleeding Love"],
  ["04.jpg", "Tru Moksha", "Eastern Essence 1.0"],
  ["05.jpg", "Me N U", "I Don't Wanna Know"],
  ["06.jpg", "Soul Wan", "Bad Guy"],
  ["07.jpg", "Kassö", "Breathe"],
  ["08.jpg", "Sapa Inca", "Hangdrum Trilogy 1.0"],
  ["09.jpg", "Kofi Z", "Bad Guy"],
  ["10.jpg", "Fluxd Out", "Birds Of A Feather"],
];

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      document.cookie =
        "auth_token=logged_in; path=/; max-age=86400; SameSite=Lax; Secure";
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = () => {
    const success = loginUser(username, password, remember);

    if (success) {
      const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

      document.cookie = `auth_token=logged_in; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      router.push("/dashboard");
    } else {
      alert("Wrong username or password");
    }
  };

  return (
    <main className="min-h-screen bg-[#050707] px-6 py-10 text-white">
      <div className="mx-auto max-w-[1300px]">
        <div className="mb-10 flex items-start justify-between gap-6">
          <header className="flex-1 text-center">
            <div className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff99]">
              NERD MUSIC
            </div>
            <h1 className="text-5xl font-bold tracking-[-0.06em] md:text-7xl">
              Latest Releases
            </h1>
          </header>

          <div className="w-[320px] rounded-2xl border border-white/10 bg-[#101414] p-4">
            <input
              type="text"
              placeholder="Username"
              className="mb-3 w-full rounded-lg bg-[#1b2020] px-3 py-2 text-sm outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="mb-3 w-full rounded-lg bg-[#1b2020] px-3 py-2 text-sm outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />

            <button
              onClick={handleLogin}
              className="w-full rounded-lg bg-[#00ff99] py-2 text-sm font-bold text-black transition hover:opacity-90"
            >
              Login
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
          {releases.map(([image, artist, title]) => (
            <div
              key={`${artist}-${title}`}
              className="rounded-[20px] border border-white/10 bg-[#101414] p-3 transition hover:-translate-y-1.5 hover:border-[#00ff99]/40 hover:bg-[#151b1b]"
            >
              <img
                src={`/${image}`}
                alt={`${artist} - ${title}`}
                className="aspect-square w-full rounded-[14px] bg-zinc-900 object-cover"
              />
              <div className="px-1 pb-1 pt-4 text-center">
                <div className="mb-1 text-sm font-bold">{artist}</div>
                <div className="text-xs text-[#a8b3b3]">{title}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}