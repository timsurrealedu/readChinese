"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddTextForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setBody(text);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 200));
      }
      setError(null);
    } catch {
      setError("Could not read that file (use UTF-8 .txt)");
    }
    e.target.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("Paste some Chinese text first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/texts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { id: number };
      router.push(`/read/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title 标题（optional）"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
      </div>
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="在这里粘贴中文文本… Paste Chinese text here (one paragraph per line)"
          rows={8}
          className="font-hanzi w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-base outline-none focus:border-zinc-500 dark:focus:border-zinc-400 resize-y"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 px-4 py-2 text-sm font-medium transition-colors"
        >
          {busy ? "Processing 处理中…" : "Open in reader 开始阅读 →"}
        </button>
        <label className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200">
          或上传 .txt 文件
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => void onFile(e)}
            className="hidden"
          />
        </label>
      </div>
    </form>
  );
}
