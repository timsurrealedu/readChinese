import type { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activity, charProgress, texts, textSegments } from "@/lib/schema";

const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function localDay(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { textId } = (payload ?? {}) as { textId?: number };
  if (!Number.isInteger(textId) || (textId as number) <= 0) {
    return Response.json({ error: "textId is required" }, { status: 400 });
  }

  const text = db
    .select({ id: texts.id })
    .from(texts)
    .where(eq(texts.id, textId as number))
    .get();
  if (!text) return Response.json({ error: "Not found" }, { status: 404 });

  const surfaces = db
    .selectDistinct({ surface: textSegments.surface })
    .from(textSegments)
    .where(sql`${textSegments.textId} = ${textId} AND ${textSegments.type} = 'hanzi'`)
    .all()
    .map((r) => r.surface)
    .filter((s) => CJK_RE.test(s));

  const now = Date.now();
  const day = localDay(now);

  db.transaction((tx) => {
    for (const ch of surfaces) {
      tx.insert(charProgress)
        .values({
          char: ch,
          exposures: 1,
          status: "seen",
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: charProgress.char,
          set: {
            exposures: sql`${charProgress.exposures} + 1`,
            lastSeenAt: now,
          },
        })
        .run();
    }
    tx.insert(activity)
      .values({ day, events: 1 })
      .onConflictDoUpdate({
        target: activity.day,
        set: { events: sql`${activity.events} + 1` },
      })
      .run();
    tx.update(texts)
      .set({ lastOpenedAt: now })
      .where(eq(texts.id, textId as number))
      .run();
  });

  return Response.json({ ok: true, trackedChars: surfaces.length });
}
