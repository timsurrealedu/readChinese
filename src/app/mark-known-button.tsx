"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkKnownButton({
  char,
  known,
}: {
  char: string;
  known?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/progress/known", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ char, known: !known }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={known ? "Mark as not known" : "I know this character"}
      className={`shrink-0 text-xs rounded-full border px-2 py-0.5 transition-colors disabled:opacity-50 ${
        known
          ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "border-zinc-300 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400"
      }`}
    >
      {known ? "✓" : "+"}
    </button>
  );
}
