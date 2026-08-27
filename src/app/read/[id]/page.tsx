import { notFound } from "next/navigation";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { charProgress, texts, textSegments } from "@/lib/schema";
import Reader, { type ReaderSegment } from "./reader";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const textId = Number(id);
  if (!Number.isInteger(textId) || textId <= 0) notFound();

  const text = db.select().from(texts).where(eq(texts.id, textId)).get();
  if (!text) notFound();

  const segments: ReaderSegment[] = db
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

  const knownChars = db
    .select({ char: charProgress.char })
    .from(charProgress)
    .where(eq(charProgress.status, "known"))
    .all()
    .map((r) => r.char);

  return (
    <Reader
      id={text.id}
      title={text.title}
      body={text.rawBody}
      hanziCount={text.hanziCount}
      segments={segments}
      knownChars={knownChars}
    />
  );
}
