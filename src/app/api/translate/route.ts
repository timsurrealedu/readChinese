import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { translationsCache } from "@/lib/schema";
import { getLlmConfig } from "@/lib/settings";

const MAX_LEN = 2000;
const TIMEOUT_MS = 45_000;

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

interface ChatChoice {
  message?: { content?: unknown };
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sentence } = (payload ?? {}) as { sentence?: string };
  if (typeof sentence !== "string" || sentence.trim().length === 0) {
    return Response.json({ error: "sentence is required" }, { status: 400 });
  }
  if (sentence.length > MAX_LEN) {
    return Response.json({ error: "sentence too long" }, { status: 413 });
  }

  const normalized = sentence.trim();
  const hash = sha256(normalized);

  const cached = db
    .select()
    .from(translationsCache)
    .where(eq(translationsCache.hash, hash))
    .get();
  if (cached) {
    return Response.json({
      translation: cached.translation,
      model: cached.model,
      cached: true,
    });
  }

  const cfg = getLlmConfig();
  if (!cfg.apiKey) {
    return Response.json(
      {
        error:
          "No API key configured. Add one in 设置 Settings to translate sentences.",
      },
      { status: 400 }
    );
  }

  let content: string | undefined;
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a Mandarin-to-English translator for a language learner. Translate the given Mandarin sentence into natural, idiomatic English. Output ONLY the translation — no pinyin, no notes, no quotes.",
          },
          { role: "user", content: normalized },
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

    const data = (await res.json()) as { choices?: ChatChoice[] };
    const raw = data.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return Response.json(
        { error: "LLM returned an empty response" },
        { status: 502 }
      );
    }
    content = raw.trim();
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "TimeoutError"
        ? "LLM request timed out"
        : `LLM request failed: ${e instanceof Error ? e.message : "unknown error"}`;
    return Response.json({ error: msg }, { status: 502 });
  }

  db.insert(translationsCache)
    .values({
      hash,
      sentence: normalized,
      translation: content,
      model: cfg.model,
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();

  return Response.json({ translation: content, model: cfg.model, cached: false });
}
