import type { NextRequest } from "next/server";
import { eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { wordSrs } from "@/lib/schema";

const INTERVALS_DAYS = [1, 3, 7, 16, 35];
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export async function GET() {
  const row = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(wordSrs)
    .where(lte(wordSrs.dueAt, Date.now()))
    .get();
  return Response.json({ due: Number(row?.c ?? 0) });
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { word, correct } = (payload ?? {}) as {
    word?: string;
    correct?: boolean;
  };

  if (typeof word !== "string" || word.length === 0) {
    return Response.json({ error: "word is required" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(wordSrs)
    .where(eq(wordSrs.word, word))
    .get();

  if (!existing) {
    return Response.json({ error: "word not in review queue" }, { status: 404 });
  }

  const now = Date.now();
  const nextIndex = correct
    ? Math.min(existing.intervalIndex + 1, INTERVALS_DAYS.length - 1)
    : 0;
  const dueAt = correct
    ? now + INTERVALS_DAYS[nextIndex] * DAY_MS
    : now + HOUR_MS;

  db.update(wordSrs)
    .set({
      intervalIndex: nextIndex,
      dueAt,
      taps: existing.taps + 1,
    })
    .where(eq(wordSrs.word, word))
    .run();

  return Response.json({ ok: true, intervalIndex: nextIndex, dueAt });
}
