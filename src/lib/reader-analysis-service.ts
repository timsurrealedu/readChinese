import { createHash } from "node:crypto";
import type { LlmConfig } from "./settings.ts";
import {
  enrichReadingAnalysis,
  READER_PROMPT_VERSION,
  splitSentences,
  validateReadingResponse,
  type AnalysisKind,
  type ParagraphReadingAnalysis,
} from "./reader-analysis.ts";

const TIMEOUT_MS = 45_000;

export function analysisCacheKey(source: string, model: string, kind: AnalysisKind): string {
  return createHash("sha256").update(JSON.stringify([source, model, kind, READER_PROMPT_VERSION]), "utf8").digest("hex");
}

function jsonContent(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) throw new Error("LLM returned an empty response");
  const clean = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean);
}

async function complete(cfg: LlmConfig, messages: Array<{ role: "system" | "user"; content: string }>, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, temperature: 0.1, response_format: { type: "json_object" }, messages }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`LLM request failed (HTTP ${response.status})`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  return jsonContent(data.choices?.[0]?.message?.content);
}

export async function analyzeReading(source: string, paragraph: number, cfg: LlmConfig, fetcher: typeof fetch = fetch): Promise<ParagraphReadingAnalysis> {
  const sentenceList = splitSentences(source);
  const messages = [{
    role: "system" as const,
    content: `You analyze Mandarin for an English-speaking learner. Return JSON only: {"sentences":[{"source":"exact source sentence","translation":"natural English","segments":[{"surface":"exact substring","type":"word|other","contextualGloss":"concise English meaning or null"}]}]}. Preserve every character, punctuation mark, and whitespace exactly and in order. Use context-sensitive, variable-length Mandarin words and expressions. Mark punctuation, whitespace, Latin text, and numbers as other with null contextualGloss. Never include pinyin. There must be exactly one item for each supplied sentence.`,
  }, {
    role: "user" as const,
    content: JSON.stringify({ sentences: sentenceList }),
  }];
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return enrichReadingAnalysis(paragraph, validateReadingResponse(source, await complete(cfg, messages, fetcher)));
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("LLM request failed")) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid analysis response");
}

export async function analyzeParagraphTranslation(source: string, cfg: LlmConfig, fetcher: typeof fetch = fetch): Promise<string> {
  const value = await complete(cfg, [{
    role: "system",
    content: "Translate the complete Mandarin paragraph into natural English. Preserve its meaning and discourse flow. Return JSON only: {\"translation\":\"...\"}.",
  }, { role: "user", content: source }], fetcher);
  if (typeof value !== "object" || value === null || typeof (value as { translation?: unknown }).translation !== "string" || !(value as { translation: string }).translation.trim()) {
    throw new Error("Invalid paragraph translation response");
  }
  return (value as { translation: string }).translation.trim();
}
