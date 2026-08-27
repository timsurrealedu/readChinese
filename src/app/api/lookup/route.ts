import type { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { textSegments } from "@/lib/schema";
import { findNgramCandidates, lookupWord } from "@/lib/cedict";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const w = sp.get("w") ?? "";
  if (!w || w.length > 32) {
    return Response.json({ exact: [], related: [], ngrams: [] });
  }

  const result = lookupWord(w);

  let ngrams: ReturnType<typeof findNgramCandidates> = [];
  const textId = Number(sp.get("t") ?? NaN);
  const para = Number(sp.get("p") ?? NaN);
  const seq = Number(sp.get("s") ?? NaN);

  if (Number.isInteger(textId) && textId > 0 && Number.isInteger(para) && Number.isInteger(seq)) {
    const segs = db
      .select({ seq: textSegments.seq, surface: textSegments.surface })
      .from(textSegments)
      .where(
        and(
          eq(textSegments.textId, textId),
          eq(textSegments.para, para)
        )
      )
      .orderBy(asc(textSegments.seq))
      .all();

    let offset = 0;
    for (const s of segs) {
      if (s.seq === seq) break;
      offset += s.surface.length;
    }

    const paragraph = segs.map((s) => s.surface).join("");
    try {
      ngrams = findNgramCandidates(paragraph, offset, w.trim()).slice(0, 6);
    } catch {
      ngrams = [];
    }
  }

  return Response.json({ ...result, ngrams });
}
