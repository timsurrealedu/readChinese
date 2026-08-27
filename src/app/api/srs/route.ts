import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { wordSrs } from "@/lib/schema";

const INTERVALS_DAYS = [1, 3, 7, 16, 35];
const DAY_MS = 86_400_000;

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { word, pinyin, sentence } = (payload ?? {}) as {
    word?: string;
    pinyin?: string;
    sentence?: string;
  };

  if (typeof word !== "string" || !/[\u3400-\u9FFF]/.test(word)) {
    return Response.json({ error: "word with hanzi is required" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(wordSrs)
    .where(eq(wordSrs.word, word))
    .get();

  if (existing) {
    db.update(wordSrs)
      .set({ taps: existing.taps + 1 })
      .where(eq(wordSrs.word, word))
      .run();
    return Response.json({ ok: true, dueAt: existing.dueAt });
  }

  const now = Date.now();
  const dueAt = now + INTERVALS_DAYS[0] * DAY_MS;
  db.insert(wordSrs)
    .values({
      word,
      pinyin: typeof pinyin === "string" ? pinyin : null,
      intervalIndex: 0,
      dueAt,
      taps: 1,
      sourceSentence: typeof sentence === "string" ? sentence.slice(0, 500) : null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();

  return Response.json({ ok: true, dueAt }, { status: 201 });
}
