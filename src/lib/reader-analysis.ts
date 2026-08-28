import { wordPinyin } from "./segment.ts";

export const READER_PROMPT_VERSION = "reading-v1";
export type AnalysisKind = "reading" | "paragraph_translation";

export interface ReadingSegment {
  surface: string;
  type: "word" | "other";
  pinyin: string | null;
  contextualGloss: string | null;
}

export interface ReadingSentence {
  source: string;
  translation: string;
  segments: ReadingSegment[];
}

export interface ParagraphReadingAnalysis {
  paragraph: number;
  sentences: ReadingSentence[];
  cached: boolean;
}

export interface RawReadingSegment {
  surface: string;
  type: "word" | "other";
  contextualGloss: string | null;
}

export interface RawReadingResponse {
  sentences: Array<{
    source: string;
    translation: string;
    segments: RawReadingSegment[];
  }>;
}

const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const TERMINAL_RE = /[。！？!?；;]/;
const CLOSER_RE = /[”’」』》〉】）)\]}]/;

export function splitSentences(source: string): string[] {
  if (!source) return [];
  const result: string[] = [];
  let start = 0;
  let i = 0;
  while (i < source.length) {
    if (!TERMINAL_RE.test(source[i])) {
      i++;
      continue;
    }
    i++;
    while (i < source.length && (TERMINAL_RE.test(source[i]) || CLOSER_RE.test(source[i]))) i++;
    while (i < source.length && /\s/.test(source[i])) i++;
    result.push(source.slice(start, i));
    start = i;
  }
  if (start < source.length) result.push(source.slice(start));
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateReadingResponse(source: string, value: unknown): RawReadingResponse {
  if (!isObject(value) || !Array.isArray(value.sentences)) throw new Error("Invalid analysis response");
  const expected = splitSentences(source);
  if (value.sentences.length !== expected.length) throw new Error("Sentence count does not match source");

  const sentences = value.sentences.map((sentence, index) => {
    if (!isObject(sentence) || sentence.source !== expected[index] || typeof sentence.translation !== "string" || !sentence.translation.trim() || !Array.isArray(sentence.segments)) {
      throw new Error(`Invalid sentence ${index}`);
    }
    const segments = sentence.segments.map((segment) => {
      if (!isObject(segment) || typeof segment.surface !== "string" || !segment.surface || (segment.type !== "word" && segment.type !== "other")) {
        throw new Error(`Invalid segment in sentence ${index}`);
      }
      const contextualGloss = segment.contextualGloss;
      if (segment.type === "word" && (typeof contextualGloss !== "string" || !contextualGloss.trim())) throw new Error(`Word is missing contextual gloss in sentence ${index}`);
      if (segment.type === "other" && contextualGloss !== null) throw new Error(`Non-word has a contextual gloss in sentence ${index}`);
      return { surface: segment.surface, type: segment.type, contextualGloss } as RawReadingSegment;
    });
    if (segments.map((segment) => segment.surface).join("") !== sentence.source) throw new Error(`Segments do not reconstruct sentence ${index}`);
    return { source: sentence.source, translation: sentence.translation, segments };
  });
  if (sentences.map((sentence) => sentence.source).join("") !== source) throw new Error("Sentences do not reconstruct paragraph");
  return { sentences };
}

export function enrichReadingAnalysis(paragraph: number, value: RawReadingResponse): ParagraphReadingAnalysis {
  return {
    paragraph,
    cached: false,
    sentences: value.sentences.map((sentence) => ({
      ...sentence,
      segments: sentence.segments.map((segment) => ({
        ...segment,
        pinyin: segment.type === "word" && CJK_RE.test(segment.surface) ? wordPinyin(segment.surface) || null : null,
      })),
    })),
  };
}
