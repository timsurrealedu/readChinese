import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { wordSrs } from "@/lib/schema";

export const metadata = { title: "词汇 Vocab" };

const INTERVAL_LABELS = ["1d", "3d", "7d", "16d", "35d"];

function currentTimeMs(): number {
  return new Date().getTime();
}

export default async function VocabPage() {
  await connection();

  const rows = db
    .select()
    .from(wordSrs)
    .orderBy(desc(wordSrs.createdAt))
    .all();

  const now = currentTimeMs();
  const due = rows.filter((r) => r.dueAt <= now).length;

  return (
    <main className="max-w-3xl w-full mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-semibold">
          词汇 Vocab{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({rows.length} saved · {due} due)
          </span>
        </h1>
        {rows.length > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            review sessions arrive in Week 4
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nothing here yet — words you tap in the{" "}
          <Link href="/library" className="underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200">
            reader
          </Link>{" "}
          and save will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {rows.map((w) => {
            const isDue = w.dueAt <= now;
            return (
              <li key={w.word} className="px-4 py-3 flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={`/library`}
                      className="font-hanzi text-lg font-medium"
                    >
                      {w.word}
                    </Link>
                    {w.pinyin && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {w.pinyin}
                      </span>
                    )}
                  </div>
                  {w.sourceSentence && (
                    <p className="font-hanzi text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      {w.sourceSentence}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <span
                    className={`inline-block text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
                      isDue
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    due {new Date(w.dueAt).toLocaleDateString()}
                  </span>
                  <div className="text-[10px] text-zinc-400">
                    box {INTERVAL_LABELS[Math.min(w.intervalIndex, INTERVAL_LABELS.length - 1)]} · {w.taps} lookups
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
