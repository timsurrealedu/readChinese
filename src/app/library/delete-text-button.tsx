"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteTextButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this text?")) return;
    setBusy(true);
    try {
      await fetch(`/api/texts/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      aria-label="Delete text"
      className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 px-1"
    >
      ✕
    </button>
  );
}
