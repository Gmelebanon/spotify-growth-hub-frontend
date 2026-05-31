import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OpenAIContent = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
};

function extractOutputText(data: OpenAIResponse) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const contentText = (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" || content.text)
    .map((content) => content.text || "")
    .join("\n")
    .trim();

  return contentText;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          message:
            "Missing OPENAI_API_KEY. Add it to .env.local locally and to Vercel Environment Variables online.",
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const prompt = String(body?.prompt || "").trim();

    if (!prompt) {
      return NextResponse.json(
        {
          message: "Prompt is required.",
        },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are the AI workspace inside Nerd Engine. Help with Spotify growth, playlist strategy, release planning, metadata, copywriting, and practical creative operations. Be specific, concise, and action-oriented.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as OpenAIResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            data.error?.message ||
            `OpenAI request failed with status ${response.status}.`,
        },
        { status: response.status }
      );
    }

    const output = extractOutputText(data);

    return NextResponse.json({
      success: true,
      output: output || "No text output returned.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not generate AI response.",
      },
      { status: 500 }
    );
  }
}
