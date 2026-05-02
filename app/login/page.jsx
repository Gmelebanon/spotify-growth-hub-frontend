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
  const [remember] = useState(true);

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
      document.cookie =
        "auth_token=logged_in; path=/; max-age=2592000; SameSite=Lax; Secure";
      router.push("/dashboard");
    } else {
      alert("Wrong username or password");
    }
  };

  return (
    <main className="min-h-screen bg-[#050707] px-6 py-10 text-white">
      <div className="mx-auto max-w-[1300px]">
        <div className="relative mb-12">
          <header className="text-center">
            <div className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff99]">
              NERD MUSIC
            </div>
            <h1 className="text-5xl font-bold tracking-[-0.06em] md:text-7xl">
              Latest Releases
            </h1>
          </header>

          <div className="mt-6 flex justify-center gap-3 md:absolute md:right-0 md:top-0 md:mt-0">
            <input
              type="text"
              placeholder="Username"
              className="h-10 w-36 rounded-lg bg-[#151b1b] px-3 text-sm outline-none ring-1 ring-white/10 focus:ring-[#00ff99]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="h-10 w-36 rounded-lg bg-[#151b1b] px-3 text-sm outline-none ring-1 ring-white/10 focus:ring-[#00ff99]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />

            <button
              onClick={handleLogin}
              className="h-10 rounded-lg bg-[#00ff99] px-5 text-sm font-bold text-black transition hover:opacity-90"
            >
              Login
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
          {releases.map((release) => (
            <a
              key={`${release.artist}-${release.title}`}
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-inherit no-underline"
            >
              <div className="rounded-[20px] border border-white/10 bg-[#101414] p-3 transition hover:-translate-y-1.5 hover:border-[#00ff99]/40 hover:bg-[#151b1b]">
                <img
                  src={release.image}
                  alt={`${release.artist} - ${release.title}`}
                  className="aspect-square w-full rounded-[14px] bg-zinc-900 object-cover"
                />

                <div className="px-1 pb-1 pt-4 text-center">
                  <div className="mb-1 text-sm font-bold">
                    {release.artist}
                  </div>
                  <div className="text-xs text-[#a8b3b3]">
                    {release.title}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}