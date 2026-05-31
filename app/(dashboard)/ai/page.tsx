"use client";

import { FormEvent, useMemo, useState } from "react";

type Idea = {
  title: string;
  description: string;
  prompt: string;
};

const IDEAS: Idea[] = [
  {
    title: "Track Suggestions",
    description: "Generate tracks based on genre, mood, BPM, and energy.",
    prompt:
      "Suggest 20 tracks for a dark techno workout playlist with high energy, cinematic tension, and underground club mood. Include artist, track title, and why each track fits.",
  },
  {
    title: "Playlist Naming",
    description: "Create better playlist titles for growth and discovery.",
    prompt:
      "Create 30 Spotify playlist name ideas for a dark electronic playlist. Make them short, searchable, memorable, and good for discovery.",
  },
  {
    title: "Description Writing",
    description: "Generate SEO-friendly playlist descriptions.",
    prompt:
      "Write 5 SEO-friendly Spotify playlist descriptions for a dark electronic / techno playlist. Keep them natural, not spammy, and include mood keywords.",
  },
  {
    title: "Growth Ideas",
    description: "Get promotion, curation, and optimization ideas.",
    prompt:
      "Give me 15 practical growth ideas for Spotify artists and playlists. Focus on metadata, release timing, playlist pitching, social content, and retention.",
  },
];

function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function SparkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16l-1.8-5L5 9.2l5.2-1.8L12 2z" />
      <path d="M19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9L19 15z" />
      <path d="M5 14l.7 2 1.8.7-1.8.7-.7 2-.7-2-1.8-.7 1.8-.7.7-2z" />
    </svg>
  );
}

export default function AIPage() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const canGenerate = useMemo(() => prompt.trim().length > 0 && !isGenerating, [
    prompt,
    isGenerating,
  ]);

  async function handleGenerate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      setErrorMessage("Write a prompt first.");
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage("");
      setCopied(false);

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });

      let data: { output?: string; message?: string } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not generate AI response.");
      }

      setOutput(data.output || "No response returned.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate AI response."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setErrorMessage("Could not copy output.");
    }
  }

  function useIdea(idea: Idea) {
    setPrompt(idea.prompt);
    setErrorMessage("");
  }

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">AI</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            AI workspace for playlist ideas, track suggestions, naming, copy, and automation.
          </p>
        </div>

        <div className="rounded-2xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-xs text-green-300">
          Powered by your OpenAI API key
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.4fr]">
        <form
          onSubmit={handleGenerate}
          className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
        >
          <h2 className="text-2xl font-semibold text-white">Prompt</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Write what you want the AI to help you with.
          </p>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: Suggest 20 tracks for a dark techno workout playlist with high energy and cinematic tension."
            className="mt-4 min-h-[260px] w-full resize-y rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm leading-6 text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPrompt("");
                setOutput("");
                setErrorMessage("");
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-800 px-5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              Clear
            </button>

            <button
              type="submit"
              disabled={!canGenerate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-400 px-5 text-sm font-semibold text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparkIcon />
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Output</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Your AI response will appear here.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!output}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-300 transition hover:border-green-400/60 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-40"
              title="Copy output"
              aria-label="Copy output"
            >
              <CopyIcon />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
            {output ? (
              <div className="min-h-[360px] whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                {output}
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center text-sm text-zinc-500">
                {isGenerating ? "Generating AI response..." : "No AI output yet."}
              </div>
            )}
          </div>

          {copied ? (
            <p className="mt-3 text-xs font-medium text-green-400">Copied to clipboard.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <h2 className="text-2xl font-semibold text-white">Ideas</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {IDEAS.map((idea) => (
            <button
              key={idea.title}
              type="button"
              onClick={() => useIdea(idea)}
              className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:border-green-400/60 hover:bg-zinc-950"
            >
              <h3 className="text-sm font-semibold text-white">{idea.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{idea.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
