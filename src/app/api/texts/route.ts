import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { texts, textSegments } from "@/lib/schema";
import { buildSegments, countHanzi } from "@/lib/segment";

const MAX_BODY = 200_000;

export async function GET() {
  const rows = db
    .select({
      id: texts.id,
      title: texts.title,
      hanziCount: texts.hanziCount,
      createdAt: texts.createdAt,
    })
    .from(texts)
    .orderBy(desc(texts.createdAt))
    .all();
  return Response.json({ texts: rows });
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, body } = (payload ?? {}) as {
    title?: string;
    body?: string;
  };

  if (typeof body !== "string" || body.trim().length === 0) {
    return Response.json({ error: "body is required" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return Response.json(
      { error: `body too large (max ${MAX_BODY} chars)` },
      { status: 413 }
    );
  }

  const safeTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim().slice(0, 200)
      : body.trim().slice(0, 24);

  const segments = buildSegments(body);
  const hanziCount = countHanzi(body);

  const textId = db.transaction((tx) => {
    const info = tx
      .insert(texts)
      .values({
        title: safeTitle,
        rawBody: body,
        hanziCount,
        createdAt: Date.now(),
      })
      .run();
    const id = Number(info.lastInsertRowid);
    const CHUNK = 1000;
    for (let i = 0; i < segments.length; i += CHUNK) {
      tx.insert(textSegments)
        .values(segments.slice(i, i + CHUNK).map((s) => ({ ...s, textId: id })))
        .run();
    }
    return id;
  });

  return Response.json({ id: textId }, { status: 201 });
}
