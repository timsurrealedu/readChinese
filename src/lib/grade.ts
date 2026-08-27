import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { charFreq, charProgress, texts, textSegments } from "./schema";

export const FREQ_WINDOW = 2500;
export const FAMILIAR_EXPOSURES = 3;
export const DAILY_TARGET = 20;
export const COVERAGE_GOAL_CHARS = 1000;

const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

let freqCache: Map<string, number> | null = null;

export function getFreqRanks(): Map<string, number> {
  if (!freqCache) {
    freqCache = new Map();
    const rows = db
      .select({ char: charFreq.char, rank: charFreq.rank })
      .from(charFreq)
      .where(sql`${charFreq.rank} <= ${FREQ_WINDOW}`)
      .all();
    for (const r of rows) freqCache.set(r.char, r.rank);
  }
  return freqCache;
}

export interface UserCharSet {
  known: Set<string>;
  familiar: Set<string>;
}

export function getUserCharSet(): UserCharSet {
  const known = new Set<string>();
  const familiar = new Set<string>();
  const rows = db.select().from(charProgress).all();
  for (const r of rows) {
    if (r.status === "known") known.add(r.char);
    else if (r.exposures >= FAMILIAR_EXPOSURES) familiar.add(r.char);
  }
  return { known, familiar };
}

export interface TextGrade {
  distinctHanzi: number;
  unknownChars: string[];
  pctUnknown: number;
}

export function isLearnable(char: string): boolean {
  return CJK_RE.test(char);
}

export function gradeChars(chars: Iterable<string>, user: UserCharSet): TextGrade {
  const freq = getFreqRanks();
  const distinct = new Set<string>();
  for (const c of chars) {
    if (isLearnable(c)) distinct.add(c);
  }
  let windowedTotal = 0;
  const unknown: string[] = [];
  for (const c of distinct) {
    const rank = freq.get(c);
    if (rank === undefined) continue;
    windowedTotal++;
    if (!user.known.has(c) && !user.familiar.has(c)) unknown.push(c);
  }
  return {
    distinctHanzi: distinct.size,
    unknownChars: unknown,
    pctUnknown:
      windowedTotal === 0
        ? 0
        : Math.round((unknown.length / Math.max(distinct.size, 1)) * 1000) / 10,
  };
}

export interface GradedText {
  id: number;
  title: string;
  hanziCount: number;
  lastOpenedAt: number | null;
  grade: TextGrade;
}

function textDistinctChars(): Map<number, Set<string>> {
  const rows = db
    .select({ textId: textSegments.textId, surface: textSegments.surface })
    .from(textSegments)
    .where(eq(textSegments.type, "hanzi"))
    .all();
  const map = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!isLearnable(r.surface)) continue;
    let set = map.get(r.textId);
    if (!set) {
      set = new Set();
      map.set(r.textId, set);
    }
    set.add(r.surface);
  }
  return map;
}

export function gradeAllTexts(user?: UserCharSet): GradedText[] {
  const u = user ?? getUserCharSet();
  const charMap = textDistinctChars();
  const rows = db
    .select({
      id: texts.id,
      title: texts.title,
      hanziCount: texts.hanziCount,
      lastOpenedAt: texts.lastOpenedAt,
    })
    .from(texts)
    .all();
  return rows.map((t) => ({
    ...t,
    grade: gradeChars(charMap.get(t.id) ?? [], u),
  }));
}

const IDEAL_PCT = 4;

export function scoreGrade(g: TextGrade): number {
  return Math.abs(g.pctUnknown - IDEAL_PCT);
}
