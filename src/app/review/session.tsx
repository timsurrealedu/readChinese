"use client";

import { useState } from "react";
import Link from "next/link";
import type { LookupResult } from "@/lib/cedict";

export interface ReviewCard {
  word: string;
  pinyin: string | null;
  sentence: string | null;
}

export default function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [defs, setDefs] = useState<string[] | null>(null);
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [goodCount, setGoodCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [done, setDone] = useState(false);

  const card = cards[idx];
  const total = cards.length;

  async function reveal() {
    setRevealed(true);
    setLoadingDefs(true);
    try {
      const res = await fetch(`/api/lookup?w=${encodeURIComponent(card.word)}`);
      const data = (await res.json()) as LookupResult;
      const first = data.exact?.[0];
      setDefs(first ? first.defs.slice(0, 3) : null);
    } catch {
      setDefs(null);
    } finally {
      setLoadingDefs(false);
    }
  }

  async function grade(correct: boolean) {
    if (correct) setGoodCount((c) => c + 1);
    else setAgainCount((c) => c + 1);
    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: card.word, correct }),
    }).catch(() => {});
    next();
  }

  function next() {
    setRevealed(false);
    setDefs(null);
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-10 text-center space-y-3">
        <p className="font-hanzi text-4xl">完成！</p>
        <div className="flex justify-center gap-6 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">
            记住了 remembered: {goodCount}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            再来一次 again: {againCount}
          </span>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          “again” words come back in 1 hour · “good” words move up the Leitner
          ladder (1d → 3d → 7d → 16d → 35d)
        </p>
        <Link
          href="/"
          className="inline-block mt-2 rounded-lg bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 px-4 py-2 text-sm font-medium transition-colors"
        >
          Back to dashboard 总览
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          card {idx + 1} / {total}
        </span>
        <span>
          ✓ {goodCount} · ↺ {againCount}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${(idx / total) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-8 text-center min-h-56 flex flex-col items-center justify-center gap-4">
        {!revealed ? (
          <>
            <div className="font-hanzi text-5xl font-semibold">{card.word}</div>
            {card.sentence && (
              <div className="font-hanzi text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                {card.sentence}
              </div>
            )}
            <button
              onClick={() => void reveal()}
              className="mt-2 rounded-lg bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 px-5 py-2 text-sm font-medium transition-colors"
            >
              显示答案 Show answer
            </button>
          </>
        ) : (
          <>
            <div className="font-hanzi text-4xl font-semibold">{card.word}</div>
            {card.pinyin && (
              <div className="text-lg text-sky-600 dark:text-sky-400">{card.pinyin}</div>
            )}
            {loadingDefs && (
              <p className="text-xs text-zinc-400">loading definition…</p>
            )}
            {defs && defs.length > 0 && (
              <ul className="text-sm text-left space-y-1 max-w-sm">
                {defs.map((d, i) => (
                  <li key={i} className="leading-relaxed">
                    · {d}
                  </li>
                ))}
              </ul>
            )}
            {!loadingDefs && (!defs || defs.length === 0) && (
              <p className="text-xs text-zinc-400">no dictionary entry found</p>
            )}
            {card.sentence && (
              <div className="font-hanzi text-sm text-zinc-500 dark:text-zinc-400 max-w-sm border-t border-zinc-100 dark:border-zinc-800 pt-3">
                {card.sentence}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-2">
              <button
                onClick={() => grade(false)}
                className="rounded-lg border border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-500/40 dark:hover:bg-amber-500/10 px-4 py-2 text-sm font-medium transition-colors"
              >
                忘了 Again
              </button>
              <button
                onClick={() => grade(true)}
                className="rounded-lg border border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/40 dark:hover:bg-emerald-500/10 px-4 py-2 text-sm font-medium transition-colors"
              >
                记住了 Good
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
