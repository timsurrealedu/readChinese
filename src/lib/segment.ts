import { pinyin } from "pinyin-pro";

export type SegmentType = "hanzi" | "other";

export interface BuiltSegment {
  para: number;
  seq: number;
  surface: string;
  type: SegmentType;
  pinyin: string | null;
}

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function isHanziLike(s: string): boolean {
  return CJK_RE.test(s);
}

export function segmentParagraph(text: string, para: number): BuiltSegment[] {
  const out: BuiltSegment[] = [];
  let seq = 0;
  for (const data of segmenter.segment(text)) {
    const surface = data.segment;
    if (surface.length === 0) continue;
    const hanzi = (data.isWordLike ?? false) && isHanziLike(surface);
    out.push({
      para,
      seq: seq++,
      surface,
      type: hanzi ? "hanzi" : "other",
      pinyin: hanzi ? wordPinyin(surface) : null,
    });
  }
  return out;
}

export function buildSegments(body: string): BuiltSegment[] {
  const paragraphs = body.split(/\r?\n/);
  const all: BuiltSegment[] = [];
  paragraphs.forEach((line, para) => {
    all.push(...segmentParagraph(line, para));
  });
  return all;
}

export function countHanzi(body: string): number {
  let n = 0;
  for (const ch of body) if (CJK_RE.test(ch)) n++;
  return n;
}

export function wordPinyin(word: string): string {
  try {
    return pinyin(word, {
      toneType: "symbol",
      type: "string",
      toneSandhi: true,
      nonZh: "consecutive",
      separator: " ",
    });
  } catch {
    return "";
  }
}
