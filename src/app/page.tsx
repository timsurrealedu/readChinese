import Link from "next/link";
import { connection } from "next/server";
import {
  DAILY_TARGET,
  FAMILIAR_EXPOSURES,
} from "@/lib/grade";
import {
  getAutoKnownCandidates,
  getCoverage,
  getNewCharsToday,
  getNextTargets,
  getRecentActivity,
  getRecommendation,
  getStreak,
} from "@/lib/stats";
import MarkKnownButton from "./mark-known-button";

export const metadata = { title: "总览 Dashboard" };

function pct(n: number, d: number): string {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

export default async function DashboardPage() {
  await connection();

  const coverage = getCoverage();
  const newToday = getNewCharsToday();
  const streak = getStreak();
  const targets = getNextTargets(10);
  const activity = getRecentActivity(14);
  const recommendation = getRecommendation();
  const autoKnown = getAutoKnownCandidates(8);

  const maxEvents = Math.max(...activity.map((a) => a.events), 1);
  const knownPct = (coverage.known / coverage.goal) * 100;
  const encPct = Math.max(
    (coverage.encountered / coverage.goal) * 100,
    knownPct
  );

  return (
    <main className="max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
      <section>
        <h1 className="text-lg font-semibold mb-1">
          目标：读懂 90% 的汉字 Goal: 90% reading coverage
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          {coverage.encountered} of the top {coverage.goal} characters encountered ·{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {pct(coverage.known, coverage.goal)} solidly known
          </span>{" "}
          · pace ≈ {DAILY_TARGET} new chars/day
        </p>

        <div className="relative h-6 rounded-full bg-zinc-200/70 dark:bg-zinc-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-sky-400/50 dark:bg-sky-500/30"
            style={{ width: `${Math.min(encPct, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 dark:bg-emerald-500"
            style={{ width: `${Math.min(knownPct, 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-zinc-900 dark:text-white">
            {coverage.encountered} / {coverage.goal}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
          <div className="text-2xl font-bold">{newToday}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            new chars today (target {DAILY_TARGET})
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min((newToday / DAILY_TARGET) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
          <div className="text-2xl font-bold">{streak}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            day streak — read anything to keep it
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
          <div className="flex items-end gap-1 h-8">
            {activity.map((a) => (
              <div
                key={a.day}
                title={`${a.day}: ${a.events} reads`}
                className={`flex-1 rounded-sm ${
                  a.events > 0 ? "bg-sky-500/70" : "bg-zinc-200 dark:bg-zinc-800"
                }`}
                style={{ height: `${Math.max((a.events / maxEvents) * 100, a.events > 0 ? 25 : 12)}%` }}
              />
            ))}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
            last 14 days of reading
          </div>
        </div>
      </section>

      <section>
        {recommendation ? (
          <Link
            href={`/read/${recommendation.id}`}
            className="block rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5 hover:border-emerald-400 transition-colors px-5 py-4 group"
          >
            <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-medium mb-1">
              推荐阅读 Recommended next read
            </div>
            <div className="font-hanzi text-xl font-semibold group-hover:underline underline-offset-4">
              {recommendation.title}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
              ~{recommendation.pctUnknown}% unfamiliar ·{" "}
              {recommendation.hanziCount} characters
            </div>
            {recommendation.unknownChars.length > 0 && (
              <div className="font-hanzi text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                New inside:{" "}
                {recommendation.unknownChars.slice(0, 12).map((c, i) => (
                  <span key={i} className="inline-block mx-0.5">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-4 text-sm text-zinc-500">
            No texts yet — add one in the{" "}
            <Link href="/library" className="underline underline-offset-4">
              library
            </Link>
            .
          </div>
        )}
      </section>

      {autoKnown.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
            快认识了吧？ Seen 5+ times — lock them in?
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {autoKnown.map((c) => (
              <li
                key={c.char}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-hanzi text-2xl leading-none">{c.char}</div>
                  <div className="text-[10px] text-zinc-400">
                    seen ×{c.exposures}
                  </div>
                </div>
                <MarkKnownButton char={c.char} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
          Next high-frequency characters 下一个目标
        </h2>
        {targets.length === 0 ? (
          <p className="text-sm text-zinc-500">
            🎉 You&apos;ve covered every character in the top {coverage.goal}!
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {targets.map((t) => (
              <li
                key={t.char}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-hanzi text-2xl leading-none">{t.char}</div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    #{t.rank} {t.pinyin?.split("/")[0] ?? ""}
                  </div>
                </div>
                <MarkKnownButton char={t.char} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
          Chars count as “known” once marked ✓ or after {FAMILIAR_EXPOSURES}+ exposures in texts.
        </p>
      </section>
    </main>
  );
}
