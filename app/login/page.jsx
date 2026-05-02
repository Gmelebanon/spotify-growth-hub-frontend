"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, loginUser } from "@/lib/simpleAuth";

const releases = [
  {
    image: "https://nerdengine.live/01.jpg",
    artist: "Synora",
    title: "432 Hz Awareness",
    url: "https://open.spotify.com/album/4U6WSixeI3ugQLBhOLkzPP?si=XsTsX4ZxR5Wsz6nkTk9glA",
  },
  {
    image: "https://nerdengine.live/02.jpg",
    artist: "Jaxen",
    title: "Blank Space",
    url: "https://open.spotify.com/album/1XxD8vzuAnHiJJnOToLjwv?si=UBL9tUyjTIqy2XqboXEHSw",
  },
  {
    image: "https://nerdengine.live/03.jpg",
    artist: "Sheri Sky",
    title: "Bleeding Love",
    url: "https://open.spotify.com/album/1H2rkAhe562F50k526x5kF?si=jvlCNdR2Rlqqkm4eh7oPwQ",
  },
  {
    image: "https://nerdengine.live/04.jpg",
    artist: "Tru Moksha",
    title: "Eastern Essence 1.0",
    url: "https://open.spotify.com/album/2pqXggOT5VaHUserDi1qXS?si=vwLLuoKqSuKwIYoTPuJO7w",
  },
  {
    image: "https://nerdengine.live/05.jpg",
    artist: "Me N U",
    title: "I Don't Wanna Know",
    url: "https://open.spotify.com/album/33tzPWRNw5mParJLsZN6SJ?si=BhiGFZbERTam7LxfR2bD-w",
  },
  {
    image: "https://nerdengine.live/06.jpg",
    artist: "Soul Wan",
    title: "Bad Guy",
    url: "https://open.spotify.com/album/3sSPbENTLwmrbP3hUHsjRX?si=d-qHn4wHRY-MOvelSRTS9A",
  },
  {
    image: "https://nerdengine.live/07.jpg",
    artist: "Kassö",
    title: "Breathe",
    url: "https://open.spotify.com/album/3N7GfEzk8qOojDUPkfcoJa?si=DhiDbWfxQTuESo9j5rhWdw",
  },
  {
    image: "https://nerdengine.live/08.jpg",
    artist: "Sapa Inca",
    title: "Hangdrum Trilogy 1.0",
    url: "https://open.spotify.com/album/2pVbLr5gf6WKtWQV5gBgYk?si=91Viko8VRyKvcr8NegBS4w",
  },
  {
    image: "https://nerdengine.live/09.jpg",
    artist: "Kofi Z",
    title: "Bad Guy",
    url: "https://open.spotify.com/album/2HRFtmDK80AlhSNOx9jq1i?si=HLN8foE6TviZmdU-Uqkydg",
  },
  {
    image: "https://nerdengine.live/10.jpg",
    artist: "Fluxd Out",
    title: "Birds Of A Feather",
    url: "https://open.spotify.com/track/4lXPxQyXgrJwwpwEq1sh72?si=15cdcaca9c354a8b",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isLoggedIn()) {
      document.cookie =
        "auth_token=logged_in; path=/; max-age=86400; SameSite=Lax; Secure";
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = () => {
    const success = loginUser(username, password, true);

    if (success) {
      document.cookie =
        "auth_token=logged_in; path=/; max-age=2592000; SameSite=Lax; Secure";
      router.push("/dashboard");
    } else {
      alert("Wrong username or password");
    }
  };

  return (
    <main className="min-h-screen bg-[#020505] text-white">
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#050707]/90 px-10 py-4 backdrop-blur-xl">
        <div className="text-sm font-black uppercase tracking-[0.3em] text-[#00ff99]">
          NERD MUSIC
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Username"
            className="h-11 w-40 rounded-xl border border-white/10 bg-[#111818] px-4 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-[#00ff99]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="h-11 w-40 rounded-xl border border-white/10 bg-[#111818] px-4 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-[#00ff99]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <button
            onClick={handleLogin}
            className="h-11 rounded-xl bg-[#00ff99] px-7 text-sm font-black text-black transition hover:bg-[#20ffad]"
          >
            Login
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-[1500px] px-10 pb-16 pt-20">
        <h1 className="mb-12 text-[64px] font-black leading-none tracking-[-0.06em] md:text-[76px]">
          Latest Releases
        </h1>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
          {releases.map((release) => (
            <a
              key={`${release.artist}-${release.title}`}
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-white/10 bg-[#0b1111] p-3 shadow-[0_0_40px_rgba(0,255,153,0.03)] transition duration-300 hover:-translate-y-1 hover:border-[#00ff99]/40 hover:bg-[#101818]"
            >
              <img
                src={release.image}
                alt={`${release.artist} - ${release.title}`}
                className="aspect-square w-full rounded-xl object-cover"
              />

              <div className="px-2 pb-2 pt-4">
                <div className="text-lg font-black">{release.artist}</div>
                <div className="mt-1 text-sm text-zinc-300">
                  {release.title}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}