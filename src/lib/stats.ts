import { and, asc, eq, gte, lte, notExists, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  activity,
  charFreq,
  charProgress,
} from "./schema";
import {
  COVERAGE_GOAL_CHARS,
  FAMILIAR_EXPOSURES,
  gradeAllTexts,
  scoreGrade,
} from "./grade";

export interface Coverage {
  known: number;
  encountered: number;
  goal: number;
}

export interface NextChar {
  char: string;
  rank: number;
  pinyin: string | null;
  gloss: string | null;
}

function startOfLocalDay(offsetDays = 0): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() + offsetDays * 86_400_000;
}

function localDayKey(offsetDays = 0): string {
  const d = new Date(startOfLocalDay(offsetDays));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getCoverage(): Coverage {
  const row = db
    .select({
      known:
        sql<number>`COALESCE(SUM(CASE WHEN ${charProgress.status} = 'known' THEN 1 ELSE 0 END), 0)`,
      encountered: sql<number>`COUNT(*)`,
    })
    .from(charProgress)
    .innerJoin(
      charFreq,
      and(eq(charFreq.char, charProgress.char), lte(charFreq.rank, COVERAGE_GOAL_CHARS))
    )
    .get();

  return {
    known: Number(row?.known ?? 0),
    encountered: Math.max(Number(row?.encountered ?? 0), Number(row?.known ?? 0)),
    goal: COVERAGE_GOAL_CHARS,
  };
}

export function getNewCharsToday(): number {
  const row = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(charProgress)
    .where(gte(charProgress.firstSeenAt, startOfLocalDay()))
    .get();
  return Number(row?.c ?? 0);
}

export function getStreak(): number {
  let streak = 0;
  const todayHasActivity =
    db
      .select()
      .from(activity)
      .where(and(eq(activity.day, localDayKey(0)), sql`${activity.events} > 0`))
      .get() !== undefined;
  const offsetStart = todayHasActivity ? 0 : 1;
  for (let i = offsetStart; i < offsetStart + 400; i++) {
    const hit =
      db
        .select()
        .from(activity)
        .where(and(eq(activity.day, localDayKey(-i)), sql`${activity.events} > 0`))
        .get() !== undefined;
    if (hit) streak++;
    else break;
  }
  return streak;
}

export function getNextTargets(limit = 12): NextChar[] {
  return db
    .select({
      char: charFreq.char,
      rank: charFreq.rank,
      pinyin: charFreq.pinyin,
      gloss: charFreq.gloss,
    })
    .from(charFreq)
    .where(
      and(
        lte(charFreq.rank, COVERAGE_GOAL_CHARS),
        notExists(
          db
            .select({ one: sql`1` })
            .from(charProgress)
            .where(
              and(
                eq(charProgress.char, charFreq.char),
                or(
                  eq(charProgress.status, "known"),
                  gte(charProgress.exposures, FAMILIAR_EXPOSURES)
                )
              )
            )
        )
      )
    )
    .orderBy(asc(charFreq.rank))
    .limit(limit)
    .all();
}

export function getRecentActivity(days = 14): { day: string; events: number }[] {
  const rows = db.select().from(activity).all();
  const byDay = new Map(rows.map((r) => [r.day, r.events]));
  const out: { day: string; events: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = localDayKey(-i);
    out.push({ day: key, events: byDay.get(key) ?? 0 });
  }
  return out;
}

export interface AutoKnownCandidate {
  char: string;
  exposures: number;
}

export function getAutoKnownCandidates(limit = 10): AutoKnownCandidate[] {
  return db
    .select({
      char: charProgress.char,
      exposures: charProgress.exposures,
    })
    .from(charProgress)
    .where(
      and(
        eq(charProgress.status, "seen"),
        gte(charProgress.exposures, 5)
      )
    )
    .orderBy(sql`${charProgress.exposures} DESC`)
    .limit(limit)
    .all();
}

export interface Recommendation {
  id: number;
  title: string;
  hanziCount: number;
  pctUnknown: number;
  unknownChars: string[];
}

export function getRecommendation(): Recommendation | null {
  const graded = gradeAllTexts();
  if (graded.length === 0) return null;

  const mostRecentId = graded.reduce(
    (best, t) => ((t.lastOpenedAt ?? 0) > (best.lastOpenedAt ?? 0) ? t : best),
    graded[0]
  ).id;

  const pool = graded.filter((t) => t.id !== mostRecentId);
  if (pool.length === 0) return null;

  const scored = pool.map((t) => ({
    ...t,
    penalty: t.lastOpenedAt ? 1.5 : 0,
  }));

  const inZone = scored
    .filter((t) => t.grade.pctUnknown >= 1 && t.grade.pctUnknown <= 10)
    .sort(
      (a, b) =>
        scoreGrade(a.grade) + a.penalty - (scoreGrade(b.grade) + b.penalty)
    );

  const pick =
    inZone[0] ?? [...scored].sort((a, b) => a.grade.pctUnknown - b.grade.pctUnknown)[0];

  return {
    id: pick.id,
    title: pick.title,
    hanziCount: pick.hanziCount,
    pctUnknown: pick.grade.pctUnknown,
    unknownChars: pick.grade.unknownChars.slice(0, 20),
  };
}
