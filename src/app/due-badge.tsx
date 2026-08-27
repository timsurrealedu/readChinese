"use client";

import { useEffect, useState } from "react";

export default function DueBadge() {
  const [due, setDue] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/review")
      .then((r) => r.json() as Promise<{ due?: number }>)
      .then((d) => {
        if (!cancelled && typeof d.due === "number" && d.due > 0) setDue(d.due);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (due === null) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-400 text-[10px] font-bold text-zinc-900 align-super">
      {due > 99 ? "99+" : due}
    </span>
  );
}
