import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { texts } from "@/lib/schema";
import { gradeAllTexts } from "@/lib/grade";
import AddTextForm from "./add-text-form";
import DeleteTextButton from "./delete-text-button";

export const metadata = { title: "书库 Library" };

function badgeStyle(pct: number): string {
  if (pct === 0)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (pct <= 10)
    return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400";
  if (pct <= 25)
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
}

export default async function LibraryPage() {
  await connection();

  const rows = db
    .select({
      id: texts.id,
      title: texts.title,
      hanziCount: texts.hanziCount,
      createdAt: texts.createdAt,
    })
    .from(texts)
    .orderBy(desc(texts.createdAt))
    .all();

  const grades = new Map(gradeAllTexts().map((g) => [g.id, g.grade]));

  return (
    <main className="max-w-3xl w-full mx-auto px-4 py-8 space-y-10">
      <section>
        <h1 className="text-lg font-semibold mb-1">添加文本 Add text</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Paste any Chinese text. It gets segmented, and pinyin is added under
          every word in the reader.
        </p>
        <AddTextForm />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          我的书库 My texts{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({rows.length})
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No texts yet — paste one above, or run{" "}
            <code className="font-mono text-xs bg-zinc-200/60 dark:bg-zinc-800 rounded px-1 py-0.5">
              npm run db:seed
            </code>{" "}
            for starter texts.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {rows.map((t) => {
              const grade = grades.get(t.id);
              const pctNew = grade?.pctUnknown ?? 0;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <Link href={`/read/${t.id}`} className="flex-1 min-w-0 group">
                    <span className="font-hanzi block truncate font-medium group-hover:underline underline-offset-4">
                      {t.title}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {t.hanziCount} characters ·{" "}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                  {grade && (
                    <span
                      title={`${grade.unknownChars.length} unfamiliar of ${grade.distinctHanzi} distinct chars`}
                      className={`shrink-0 text-xs rounded-full px-2 py-1 font-medium ${badgeStyle(pctNew)}`}
                    >
                      {pctNew}% new
                    </span>
                  )}
                  <DeleteTextButton id={t.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
