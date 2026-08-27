import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { texts, textSegments } from "@/lib/schema";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const textId = parseId(id);
  if (!textId) return Response.json({ error: "Bad id" }, { status: 400 });

  const text = db.select().from(texts).where(eq(texts.id, textId)).get();
  if (!text) return Response.json({ error: "Not found" }, { status: 404 });

  const segments = db
    .select({
      para: textSegments.para,
      seq: textSegments.seq,
      surface: textSegments.surface,
      type: textSegments.type,
      pinyin: textSegments.pinyin,
    })
    .from(textSegments)
    .where(eq(textSegments.textId, textId))
    .orderBy(asc(textSegments.para), asc(textSegments.seq))
    .all();

  return Response.json({ text, segments });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const textId = parseId(id);
  if (!textId) return Response.json({ error: "Bad id" }, { status: 400 });
  db.delete(texts).where(eq(texts.id, textId)).run();
  return Response.json({ ok: true });
}
