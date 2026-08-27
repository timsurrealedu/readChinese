import Link from "next/link";
import { connection } from "next/server";
import { asc, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { wordSrs } from "@/lib/schema";
import ReviewSession, { type ReviewCard } from "./session";

export const metadata = { title: "复习 Review" };

function currentTimeMs(): number {
  return new Date().getTime();
}

export default async function ReviewPage() {
  await connection();

  const now = currentTimeMs();
  const dueRows = db
    .select({
      word: wordSrs.word,
      pinyin: wordSrs.pinyin,
      sourceSentence: wordSrs.sourceSentence,
    })
    .from(wordSrs)
    .where(lte(wordSrs.dueAt, now))
    .orderBy(asc(wordSrs.dueAt))
    .limit(50)
    .all();

  const totals = db
    .select({
      saved: sql<number>`COUNT(*)`,
      dueSoon: sql<number>`COALESCE(SUM(CASE WHEN ${wordSrs.dueAt} <= ${now} THEN 1 ELSE 0 END), 0)`,
    })
    .from(wordSrs)
    .get();

  const cards: ReviewCard[] = dueRows.map((r) => ({
    word: r.word,
    pinyin: r.pinyin,
    sentence: r.sourceSentence,
  }));

  return (
    <main className="max-w-xl w-full mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← 总览 Dashboard
        </Link>
        <h1 className="text-lg font-semibold mt-1">复习 Review</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {Number(totals?.saved ?? 0)} words saved ·{" "}
          {cards.length} due now · {Number(totals?.dueSoon ?? 0)} in queue
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-10 text-center space-y-2">
          <p className="font-hanzi text-4xl">太棒了</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All caught up — no reviews due.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Save words from the reader to build your deck.
          </p>
        </div>
      ) : (
        <ReviewSession cards={cards} />
      )}
    </main>
  );
}
