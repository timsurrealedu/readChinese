import { db } from "./db";
import { vocab } from "./schema";
import { eq, inArray, or } from "drizzle-orm";

export interface DictEntry {
  simplified: string;
  traditional: string;
  pinyin: string;
  defs: string[];
}

const TONE_VOWELS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

function markSyllable(letters: string, tone: number): string {
  if (tone < 1 || tone > 4) return letters;
  const lower = letters.toLowerCase();
  const marks = (v: string) => TONE_VOWELS[v][tone - 1];
  const replaceAt = (i: number) =>
    letters.slice(0, i) +
    marks(lower[i]) +
    letters.slice(i + 1);
  let idx = lower.indexOf("a");
  if (idx !== -1) return replaceAt(idx);
  idx = lower.indexOf("o");
  if (idx !== -1) return replaceAt(idx);
  idx = lower.indexOf("e");
  if (idx !== -1) return replaceAt(idx);
  for (let i = lower.length - 1; i >= 0; i--) {
    if ("iuü".includes(lower[i])) return replaceAt(i);
  }
  return letters;
}

export function numberedToMarked(pinyinNum: string): string {
  const normalized = pinyinNum.replace(/u:/gi, "ü");
  return normalized.replace(
    /([A-Za-zü]+)([1-5])/g,
    (_m, letters: string, digit: string) =>
      markSyllable(letters, Number(digit))
  );
}

interface VocabRow {
  id: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  defs: string;
}

function toEntry(row: VocabRow): DictEntry {
  let defs: string[] = [];
  try {
    defs = JSON.parse(row.defs) as string[];
  } catch {}
  return {
    simplified: row.simplified,
    traditional: row.traditional,
    pinyin: numberedToMarked(row.pinyin),
    defs,
  };
}

function dedupe(rows: VocabRow[]): DictEntry[] {
  const seen = new Set<number>();
  const out: DictEntry[] = [];
  for (const row of rows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(toEntry(row));
    }
  }
  return out;
}

function selectVocab() {
  return db
    .select({
      id: vocab.id,
      simplified: vocab.simplified,
      traditional: vocab.traditional,
      pinyin: vocab.pinyin,
      defs: vocab.defs,
    })
    .from(vocab);
}

export interface LookupResult {
  exact: DictEntry[];
  related: { surface: string; entries: DictEntry[] }[];
  ngrams?: NgramCandidate[];
}

export function lookupWord(word: string): LookupResult {
  const w = word.trim();
  if (!w) return { exact: [], related: [] };

  const exactRows = selectVocab()
    .where(or(eq(vocab.simplified, w), eq(vocab.traditional, w)))
    .all();
  const exact = dedupe(exactRows);

  const related = new Map<string, DictEntry[]>();

  const substrings = new Set<string>();
  for (let len = Math.min(w.length, 6); len >= 2; len--) {
    for (let i = 0; i + len <= w.length; i++) {
      substrings.add(w.slice(i, i + len));
    }
  }
  for (const ch of w) substrings.add(ch);

  if (substrings.size > 0) {
    const rows = selectVocab()
      .where(inArray(vocab.simplified, [...substrings]))
      .all();
    for (const row of rows) {
      const list = related.get(row.simplified) ?? [];
      list.push(toEntry(row));
      related.set(row.simplified, list);
    }
  }

  const relatedList = [...related.entries()]
    .filter(([surface]) => surface !== w || exact.length === 0)
    .sort((a, b) => b[0].length - a[0].length)
    .slice(0, 8)
    .map(([surface, entries]) => ({ surface, entries }));

  return { exact, related: relatedList };
}

export interface NgramCandidate {
  n: number;
  text: string;
  pinyin: string;
  gloss: string;
}

export function findNgramCandidates(
  paragraph: string,
  offset: number,
  exclude: string,
  maxLen = 8
): NgramCandidate[] {
  const candidates: string[] = [];
  const limit = Math.min(maxLen, paragraph.length - offset);
  for (let n = 1; n <= limit; n++) {
    const text = paragraph.slice(offset, offset + n);
    if (!/[\u3400-\u9FFF]/.test(text)) break;
    if (text !== exclude) candidates.push(text);
  }
  if (candidates.length === 0) return [];

  const rows = selectVocab()
    .where(inArray(vocab.simplified, candidates))
    .all();

  const first = new Map<string, { row: VocabRow; order: number }>();
  rows.forEach((row) => {
    const prev = first.get(row.simplified);
    if (!prev || row.id < prev.row.id) first.set(row.simplified, { row, order: 0 });
  });

  return candidates
    .filter((c) => first.has(c))
    .map((c) => {
      const entry = toEntry(first.get(c)!.row);
      return {
        n: [...c].length,
        text: c,
        pinyin: entry.pinyin,
        gloss: entry.defs[0] ?? "",
      };
    });
}
