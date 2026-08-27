"use client";

import { useEffect, useState } from "react";

interface SettingsView {
  baseUrl: string;
  model: string;
  hasKey: boolean;
  keyPreview: string | null;
}

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json() as Promise<SettingsView>)
      .then((v) => {
        setView(v);
        setBaseUrl(v.baseUrl);
        setModel(v.model);
      })
      .catch(() => setError("Failed to load settings"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, string> = { baseUrl, model };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as SettingsView & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setView(data);
      setApiKey("");
      setMessage("Saved ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const data = (await res.json()) as SettingsView;
      setView(data);
      setMessage("API key cleared");
    } catch {
      setError("Failed to clear key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-2xl w-full mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold mb-1">设置 Settings</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Configure any OpenAI-compatible API for sentence translation
        (OpenAI, DeepSeek, BytePlus Ark, Ollama, …). Your key is stored locally
        and never leaves this machine except to call the provider.
      </p>

      <form onSubmit={save} className="space-y-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">API Base URL</label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              view?.hasKey ? `Saved ${view.keyPreview} — leave blank to keep` : "sk-…"
            }
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />
          {view?.hasKey && (
            <button
              type="button"
              onClick={clearKey}
              disabled={busy}
              className="mt-2 text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
            >
              Remove saved key
            </button>
          )}
        </div>

        {message && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 px-4 py-2 text-sm font-medium transition-colors"
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
    </main>
  );
}
