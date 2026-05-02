"use client";

export default function AIPage() {
  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">AI</h1>
        <p className="mt-2 text-sm text-zinc-500">
          AI workspace for playlist ideas, track suggestions, naming, copy, and automation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.4fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <h2 className="text-2xl font-semibold text-white">Prompt</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Write what you want the AI to help you with.
          </p>

          <textarea
            placeholder="Example: Suggest 20 tracks for a dark techno workout playlist with high energy and cinematic tension."
            className="mt-4 min-h-[220px] w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
          />

          <div className="mt-4 flex items-center justify-end">
            <button className="inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-5 text-sm font-semibold text-white transition hover:bg-green-500">
              Generate
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <h2 className="text-2xl font-semibold text-white">Output</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Your AI response will appear here.
          </p>

          <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
            <div className="flex min-h-[320px] items-center justify-center text-sm text-zinc-500">
              No AI output yet.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <h2 className="text-2xl font-semibold text-white">Ideas</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            <h3 className="text-sm font-semibold text-white">Track Suggestions</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Generate tracks based on genre, mood, BPM, and energy.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            <h3 className="text-sm font-semibold text-white">Playlist Naming</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Create better playlist titles for growth and discovery.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            <h3 className="text-sm font-semibold text-white">Description Writing</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Generate SEO-friendly playlist descriptions.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            <h3 className="text-sm font-semibold text-white">Growth Ideas</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Get promotion, curation, and optimization ideas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}