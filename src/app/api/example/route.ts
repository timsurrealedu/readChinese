import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examplesCache } from "@/lib/schema";
import { getLlmConfig } from "@/lib/settings";

const TIMEOUT_MS = 45_000;

interface ExampleItem {
  zh: string;
  pinyin: string;
  en: string;
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { word } = (payload ?? {}) as { word?: string };
  if (typeof word !== "string" || !word.trim() || word.trim().length > 20) {
    return Response.json({ error: "word is required" }, { status: 400 });
  }
  const w = word.trim();

  const cached = db
    .select()
    .from(examplesCache)
    .where(eq(examplesCache.word, w))
    .get();
  if (cached) {
    try {
      const items = JSON.parse(cached.data) as ExampleItem[];
      if (Array.isArray(items) && items.length > 0) {
        return Response.json({ examples: items, cached: true });
      }
    } catch {}
  }

  const cfg = getLlmConfig();
  if (!cfg.apiKey) {
    return Response.json(
      {
        error:
          "No API key configured. Add one in 设置 Settings to generate examples.",
      },
      { status: 400 }
    );
  }

  let raw = "";
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              'You are a Mandarin teaching assistant. Generate exactly 2 short, natural, everyday example sentences that clearly show how the given Mandarin word is used — if it is a grammatical particle or function word, the sentences MUST demonstrate its grammar (e.g. aspect markers like 着/了/过). Reply with ONLY a JSON array, no markdown fences: [{"zh":"句子","pinyin":"jù zi","en":"English translation"},{"zh":"…","pinyin":"…","en":"…"}]',
          },
          { role: "user", content: w },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: `LLM request failed (HTTP ${res.status})`, detail: detail.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    raw = typeof data.choices?.[0]?.message?.content === "string"
      ? data.choices[0].message!.content!
      : "";
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "TimeoutError"
        ? "LLM request timed out"
        : `LLM request failed: ${e instanceof Error ? e.message : "unknown error"}`;
    return Response.json({ error: msg }, { status: 502 });
  }

  let items: ExampleItem[] = [];
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        items = parsed
          .filter(
            (it): it is ExampleItem =>
              typeof it === "object" &&
              it !== null &&
              typeof (it as ExampleItem).zh === "string" &&
              typeof (it as ExampleItem).en === "string"
          )
          .map((it) => ({
            zh: String(it.zh),
            pinyin: typeof it.pinyin === "string" ? it.pinyin : "",
            en: String(it.en),
          }))
          .slice(0, 3);
      }
    } catch {}
  }

  if (items.length === 0) {
    return Response.json(
      { error: "Could not parse LLM examples response" },
      { status: 502 }
    );
  }

  db.insert(examplesCache)
    .values({
      word: w,
      data: JSON.stringify(items),
      model: cfg.model,
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();

  return Response.json({ examples: items, cached: false });
}
