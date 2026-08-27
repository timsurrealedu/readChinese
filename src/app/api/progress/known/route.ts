import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { charProgress } from "@/lib/schema";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { char, known } = (payload ?? {}) as { char?: string; known?: boolean };
  if (typeof char !== "string" || char.length !== 1) {
    return Response.json({ error: "single char required" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(charProgress)
    .where(eq(charProgress.char, char))
    .get();

  const now = Date.now();
  const nextStatus = known ? "known" : existing && existing.exposures > 0 ? "seen" : "new";

  if (!existing) {
    if (!known) return Response.json({ ok: true, status: nextStatus });
    db.insert(charProgress)
      .values({
        char,
        exposures: 0,
        status: nextStatus,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .run();
  } else {
    db.update(charProgress)
      .set({ status: nextStatus, lastSeenAt: now })
      .where(eq(charProgress.char, char))
      .run();
  }

  const updated = db
    .select()
    .from(charProgress)
    .where(eq(charProgress.char, char))
    .get();

  return Response.json({ ok: true, status: updated?.status });
}
