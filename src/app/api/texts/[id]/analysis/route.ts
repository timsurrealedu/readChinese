import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { readerAnalysisCache, texts } from "@/lib/schema";
import { getLlmConfig } from "@/lib/settings";
import { READER_PROMPT_VERSION, type AnalysisKind, type ParagraphReadingAnalysis } from "@/lib/reader-analysis";
import { analysisCacheKey, analyzeParagraphTranslation, analyzeReading } from "@/lib/reader-analysis-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const textId = Number((await params).id);
  if (!Number.isInteger(textId) || textId <= 0) return Response.json({ error: "Invalid text ID" }, { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { paragraph, kind } = (payload ?? {}) as { paragraph?: unknown; kind?: unknown };
  if (!Number.isInteger(paragraph) || (paragraph as number) < 0 || (kind !== "reading" && kind !== "paragraph_translation")) {
    return Response.json({ error: "paragraph and a valid analysis kind are required" }, { status: 400 });
  }

  const text = db.select({ rawBody: texts.rawBody }).from(texts).where(eq(texts.id, textId)).get();
  if (!text) return Response.json({ error: "Text not found" }, { status: 404 });
  const source = text.rawBody.split(/\r?\n/)[paragraph as number];
  if (source === undefined) return Response.json({ error: "Paragraph not found" }, { status: 404 });
  if (!source.trim()) return Response.json({ error: "Empty paragraphs do not require analysis" }, { status: 400 });

  const cfg = getLlmConfig();
  const analysisKind = kind as AnalysisKind;
  const cacheKey = analysisCacheKey(source, cfg.model, analysisKind);
  const cached = db.select().from(readerAnalysisCache).where(eq(readerAnalysisCache.cacheKey, cacheKey)).get();
  if (cached) {
    try {
      const result = JSON.parse(cached.resultJson) as ParagraphReadingAnalysis | { paragraph: number; translation: string };
      return Response.json({ ...result, cached: true });
    } catch {
      db.delete(readerAnalysisCache).where(eq(readerAnalysisCache.cacheKey, cacheKey)).run();
    }
  }

  if (!cfg.apiKey) {
    return Response.json({ error: "Add an API key in Settings to enable contextual analysis", code: "API_KEY_REQUIRED" }, { status: 428 });
  }

  try {
    const result = analysisKind === "reading"
      ? await analyzeReading(source, paragraph as number, cfg)
      : { paragraph: paragraph as number, translation: await analyzeParagraphTranslation(source, cfg) };
    db.insert(readerAnalysisCache).values({
      cacheKey,
      textId,
      paragraphIndex: paragraph as number,
      analysisKind,
      resultJson: JSON.stringify(result),
      model: cfg.model,
      promptVersion: READER_PROMPT_VERSION,
      createdAt: Date.now(),
    }).onConflictDoNothing().run();
    return Response.json({ ...result, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
