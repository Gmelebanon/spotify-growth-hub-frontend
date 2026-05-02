"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, loginUser } from "@/lib/simpleAuth";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-80 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="mb-6 text-xl font-semibold">Login</h1>

        <input
          type="text"
          placeholder="Username"
          className="mb-3 w-full rounded bg-zinc-800 p-2 outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-3 w-full rounded bg-zinc-800 p-2 outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={remember}
            onChange={() => setRemember(!remember)}
          />
          Remember me
        </label>

        <button
          onClick={handleLogin}
          className="w-full rounded bg-green-500 p-2 font-medium text-black hover:bg-green-400"
        >
          Enter
        </button>
      </div>
    </div>
  );
}