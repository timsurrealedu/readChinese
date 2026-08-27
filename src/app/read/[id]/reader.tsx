"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LookupResult } from "@/lib/cedict";
import { getParticleNote } from "@/lib/particles";

export interface ReaderSegment {
  para: number;
  seq: number;
  surface: string;
  type: string;
  pinyin: string | null;
}

interface Props {
  id: number;
  title: string;
  body: string;
  hanziCount: number;
  segments: ReaderSegment[];
  knownChars: string[];
}

interface Selection {
  surface: string;
  pinyin: string | null;
}

interface NgramCand {
  n: number;
  text: string;
  pinyin: string;
  gloss: string;
}

interface ExampleItem {
  zh: string;
  pinyin: string;
  en: string;
}

interface Prefs {
  showPinyin: boolean;
  hideKnown: boolean;
  toneMode: "off" | "color" | "line";
  traditional: boolean;
}

const DEFAULT_PREFS: Prefs = {
  showPinyin: true,
  hideKnown: true,
  toneMode: "off",
  traditional: false,
};

const PREFS_KEY = "rc-prefs";

const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

const TONE_MARKS: Record<string, number> = {};
for (const [i, vowels] of [
  ["ā", "á", "ǎ", "à"],
  ["ē", "é", "ě", "è"],
  ["ī", "í", "ǐ", "ì"],
  ["ō", "ó", "ǒ", "ò"],
  ["ū", "ú", "ǔ", "ù"],
  ["ǖ", "ǘ", "ǚ", "ǜ"],
].entries()) {
  for (const v of vowels) TONE_MARKS[v] = i + 1;
}

const TONE_CLASSES = [
  "",
  "text-rose-500 dark:text-rose-400",
  "text-emerald-500 dark:text-emerald-400",
  "text-blue-500 dark:text-blue-400",
  "text-purple-500 dark:text-purple-400",
];

function toneOf(syllable: string): number {
  for (const ch of syllable) {
    const t = TONE_MARKS[ch];
    if (t) return t;
  }
  return 0;
}

const TONE_SYMBOLS = ["", "\u02C9", "\u02CA", "\u02C7", "\u0060"];

function toneLineSymbol(syllable: string): string {
  return TONE_SYMBOLS[toneOf(syllable)];
}

export default function Reader({
  id,
  title,
  body,
  hanziCount,
  segments,
  knownChars,
}: Props) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [transError, setTransError] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState<string>("");
  const [ctxNgrams, setCtxNgrams] = useState<NgramCand[]>([]);
  const [showExamples, setShowExamples] = useState(false);
  const [examples, setExamples] = useState<ExampleItem[] | null>(null);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const [converter, setConverter] = useState<
    ((s: string) => string) | null
  >(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const reqIdRef = useRef(0);
  const translationCacheRef = useRef(new Map<string, string>());

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PREFS_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed: Partial<Prefs> & { toneColors?: boolean };
    try {
      parsed = JSON.parse(raw) as Partial<Prefs> & { toneColors?: boolean };
    } catch {
      return;
    }
    if (parsed.toneMode === undefined && typeof parsed.toneColors === "boolean") {
      parsed.toneMode = parsed.toneColors ? "color" : "off";
      delete parsed.toneColors;
    }
    queueMicrotask(() => setPrefs({ ...DEFAULT_PREFS, ...parsed }));
  }, []);

  function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (!prefs.traditional) return;
    let cancelled = false;
    import("opencc-js")
      .then((OpenCC) => {
        if (!cancelled)
          setConverter(() => OpenCC.Converter({ from: "cn", to: "t" }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefs.traditional]);

  const knownSet = useMemo(() => new Set(knownChars), [knownChars]);

  const paragraphs = useMemo(() => {
    const map = new Map<number, ReaderSegment[]>();
    for (const s of segments) {
      const list = map.get(s.para) ?? [];
      list.push(s);
      map.set(s.para, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);
  }, [segments]);

  function display(s: string): string {
    return prefs.traditional && converter ? converter(s) : s;
  }

  function segmentFullyKnown(surface: string): boolean {
    let hasHanzi = false;
    for (const ch of surface) {
      if (!CJK_RE.test(ch)) continue;
      hasHanzi = true;
      if (!knownSet.has(ch)) return false;
    }
    return hasHanzi;
  }

  async function selectWord(seg: ReaderSegment) {
    const reqId = ++reqIdRef.current;
    const sel: Selection = { surface: seg.surface, pinyin: seg.pinyin };
    setSelection(sel);
    setCurrentQ(sel.surface);
    setLookup(null);
    setLoadingLookup(true);
    setTranslation(null);
    setTranslating(false);
    setTransError(null);
    setCtxNgrams([]);
    setShowExamples(false);
    setExamples(null);
    setExampleError(null);
    try {
      const res = await fetch(
        `/api/lookup?w=${encodeURIComponent(sel.surface)}&t=${id}&p=${seg.para}&s=${seg.seq}`
      );
      const data = (await res.json()) as LookupResult;
      if (reqIdRef.current === reqId) {
        setLookup(data);
        if (data.ngrams) setCtxNgrams(data.ngrams);
      }
    } catch {
      if (reqIdRef.current === reqId)
        setLookup({ exact: [], related: [] });
    } finally {
      if (reqIdRef.current === reqId) setLoadingLookup(false);
    }
  }

  async function pickNgram(text: string) {
    const reqId = ++reqIdRef.current;
    setCurrentQ(text);
    setLoadingLookup(true);
    setTranslation(null);
    setTranslating(false);
    setTransError(null);
    setShowExamples(false);
    setExamples(null);
    setExampleError(null);
    try {
      const res = await fetch(`/api/lookup?w=${encodeURIComponent(text)}`);
      const data = (await res.json()) as LookupResult;
      if (reqIdRef.current === reqId) setLookup(data);
    } catch {
      if (reqIdRef.current === reqId) setLookup({ exact: [], related: [] });
    } finally {
      if (reqIdRef.current === reqId) setLoadingLookup(false);
    }
  }

  async function toggleExamples() {
    const next = !showExamples;
    setShowExamples(next);
    if (!next || !selection) return;
    const word = currentQ || selection.surface;
    if (examples || loadingExamples) return;
    setLoadingExamples(true);
    setExampleError(null);
    try {
      const res = await fetch("/api/example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = (await res.json()) as { examples?: ExampleItem[]; error?: string };
      if (!res.ok || !data.examples) throw new Error(data.error ?? `HTTP ${res.status}`);
      setExamples(data.examples);
    } catch (err) {
      setExampleError(err instanceof Error ? err.message : "Failed to load examples");
    } finally {
      setLoadingExamples(false);
    }
  }

  async function translateSentence() {
    if (!selection) return;
    const sentence = findSentenceFor(selection.surface);
    if (!sentence) return;

    const cachedT = translationCacheRef.current.get(sentence);
    if (cachedT) {
      setTranslation(cachedT);
      return;
    }

    const reqId = ++reqIdRef.current;
    setTranslating(true);
    setTransError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence }),
      });
      const data = (await res.json()) as { translation?: string; error?: string };
      if (reqIdRef.current !== reqId) return;
      if (!res.ok || !data.translation) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      translationCacheRef.current.set(sentence, data.translation);
      setTranslation(data.translation);
    } catch (err) {
      if (reqIdRef.current !== reqId) return;
      setTranslation(null);
      setTransError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      if (reqIdRef.current === reqId) setTranslating(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const tracked = sessionStorage.getItem(`rc-tracked-${id}`);
    if (tracked) return;
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textId: id }),
    })
      .then(() => sessionStorage.setItem(`rc-tracked-${id}`, "1"))
      .catch(() => {});
  }, [id]);

  async function saveToReview() {
    if (!selection) return;
    const word = currentQ || selection.surface;
    const sentence = findSentenceFor(word);
    await fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, pinyin: selection.pinyin, sentence }),
    });
    setSavedWords((prev) => new Set(prev).add(word));
  }

  function findSentenceFor(word: string): string | undefined {
    for (const para of body.split(/\r?\n/)) {
      if (!para.includes(word)) continue;
      for (const part of para.split(/(?<=[。！？!?；;])/)) {
        if (part.includes(word)) return part.trim();
      }
    }
    return undefined;
  }

  function renderRt(pinyinStr: string) {
    if (prefs.toneMode === "line") {
      return pinyinStr
        .trim()
        .split(/\s+/)
        .map((syl, i) => (
          <span key={i} className="tracking-widest">
            {i > 0 ? "\u2009" : ""}
            {toneLineSymbol(syl)}
          </span>
        ));
    }
    if (prefs.toneMode === "color") {
      const parts = pinyinStr.split(/(\s+)/);
      return (
        <>
          {parts.map((syl, i) =>
            /^\s+$/.test(syl) ? (
              syl
            ) : (
              <span key={i} className={TONE_CLASSES[toneOf(syl)]}>
                {syl}
              </span>
            )
          )}
        </>
      );
    }
    return pinyinStr;
  }

  return (
    <main className="max-w-3xl w-full mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-6">
        <div className="min-w-0">
          <Link
            href="/library"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← 书库 Library
          </Link>
          <h1 className="font-hanzi text-xl font-semibold truncate mt-1">
            {display(title)}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {hanziCount} characters · tap any word to look it up
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs shrink-0 select-none">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.showPinyin}
              onChange={(e) => setPref("showPinyin", e.target.checked)}
              className="h-3.5 w-3.5 accent-zinc-900 dark:accent-white"
            />
            <span className="text-zinc-500 dark:text-zinc-400">
              拼音 Pinyin
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer" title="Hide pinyin above characters you already know">
            <input
              type="checkbox"
              checked={prefs.hideKnown}
              onChange={(e) => setPref("hideKnown", e.target.checked)}
              className="h-3.5 w-3.5 accent-zinc-900 dark:accent-white"
            />
            <span className="text-zinc-500 dark:text-zinc-400">藏已会 Hide known</span>
          </label>
          <div
            className="flex items-center gap-1"
            title="Tone display: off / color-coded / contour lines"
          >
            <span className="text-zinc-500 dark:text-zinc-400 mr-0.5">声调 Tone</span>
            {(
              [
                ["off", "–", "none"],
                ["color", "色", "color-coded"],
                ["line", "线", "contour lines"],
              ] as const
            ).map(([mode, label, title]) => (
              <button
                key={mode}
                onClick={() => setPref("toneMode", mode)}
                title={title}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  prefs.toneMode === mode
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer" title="Show traditional characters">
            <input
              type="checkbox"
              checked={prefs.traditional}
              onChange={(e) => setPref("traditional", e.target.checked)}
              className="h-3.5 w-3.5 accent-zinc-900 dark:accent-white"
            />
            <span className="text-zinc-500 dark:text-zinc-400">繁體 Trad.</span>
          </label>
        </div>
      </div>

      <article
        className="font-hanzi text-[1.7rem] leading-[2.6rem] sm:text-[2rem] sm:leading-[3.2rem] bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 sm:px-8 py-8"
        onClick={() => setSelection(null)}
      >
        {paragraphs.map((para, pi) => (
          <p key={pi} className={pi > 0 ? "mt-6" : ""}>
            {para.map((seg) => {
              if (seg.type !== "hanzi") {
                return (
                  <span key={`${seg.para}-${seg.seq}`} className="whitespace-pre-wrap">
                    {seg.surface}
                  </span>
                );
              }
              const showRt =
                prefs.showPinyin &&
                !!seg.pinyin &&
                !(prefs.hideKnown && segmentFullyKnown(seg.surface));
              const syllables = seg.pinyin?.trim().split(/\s+/) ?? [];
              const chars = [...display(seg.surface)];
              const perCharLines =
                prefs.toneMode === "line" &&
                showRt &&
                chars.length > 1 &&
                syllables.length === chars.length;
              const dimClass =
                prefs.hideKnown && segmentFullyKnown(seg.surface)
                  ? "opacity-90"
                  : "";
              const clickHandler = (e: React.MouseEvent) => {
                e.stopPropagation();
                void selectWord(seg);
              };
              if (perCharLines) {
                return chars.map((ch, ci) => (
                  <ruby
                    key={`${seg.para}-${seg.seq}-${ci}`}
                    className={`hz-word cursor-pointer rounded transition-colors hover:bg-amber-100/70 dark:hover:bg-amber-500/15 ${dimClass}`}
                    onClick={clickHandler}
                  >
                    {ch}
                    <rt>{toneLineSymbol(syllables[ci]) || "\u00A0"}</rt>
                  </ruby>
                ));
              }
              return (
                <ruby
                  key={`${seg.para}-${seg.seq}`}
                  className={`hz-word cursor-pointer rounded transition-colors hover:bg-amber-100/70 dark:hover:bg-amber-500/15 ${dimClass}`}
                  onClick={clickHandler}
                >
                  {display(seg.surface)}
                  {showRt ? <rt>{renderRt(seg.pinyin as string)}</rt> : null}
                </ruby>
              );
            })}
          </p>
        ))}
      </article>

      {selection && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelection(null)}
          />
          <div
            ref={sheetRef}
            className="fixed z-50 bottom-0 inset-x-0 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 max-h-[55vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
          >
            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-hanzi text-3xl font-semibold break-all leading-snug">
                    {display(currentQ || selection.surface)}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {lookup?.exact?.[0]?.pinyin ??
                      (currentQ === selection.surface ? selection.pinyin : "")}
                    {lookup?.exact && lookup.exact.length > 1
                      ? ` · +${lookup.exact.length - 1} more senses`
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => setSelection(null)}
                  aria-label="Close"
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg shrink-0"
                >
                  ✕
                </button>
              </div>

              {ctxNgrams.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Context 上下文 — same spot, longer words
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {ctxNgrams.map((g) => (
                      <button
                        key={g.text}
                        onClick={() => void pickNgram(g.text)}
                        title={`${g.pinyin} — ${g.gloss}`}
                        className={`font-hanzi rounded-full border px-2.5 py-1 text-sm transition-colors ${
                          currentQ === g.text
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                            : "border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {display(g.text)}{" "}
                        <span className="text-[10px] opacity-60">{g.n}字</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={saveToReview}
                  disabled={savedWords.has(currentQ || selection.surface)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
                >
                  {savedWords.has(currentQ || selection.surface)
                    ? "✓ 已保存 Saved"
                    : "+ 加入复习 Save"}
                </button>
                <button
                  onClick={() => void translateSentence()}
                  disabled={translating || !findSentenceFor(selection.surface)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
                >
                  {translating ? "翻译中…" : "译整句 Translate"}
                </button>
              </div>

              <button
                onClick={() => void toggleExamples()}
                disabled={loadingExamples}
                className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
              >
                {showExamples ? "▲ 隐藏例句 Hide examples" : "▼ 例句 Examples (AI)"}
              </button>

              {showExamples && (
                <div className="mt-2 rounded-lg bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2 space-y-2">
                  {loadingExamples && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Generating examples… 造句中…
                    </p>
                  )}
                  {exampleError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{exampleError}</p>
                  )}
                  {examples?.map((ex, i) => (
                    <div key={i}>
                      <div className="font-hanzi text-base leading-snug">{ex.zh}</div>
                      {ex.pinyin && (
                        <div className="text-[11px] text-zinc-400">{ex.pinyin}</div>
                      )}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        {ex.en}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const particle = getParticleNote(
                  currentQ || selection.surface
                );
                if (!particle) return null;
                return (
                  <div className="mt-3 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-0.5">
                      语法 Grammar · {particle.label}{" "}
                      <span className="normal-case opacity-70">({particle.pinyin})</span>
                    </div>
                    <p className="text-xs leading-relaxed">{particle.note}</p>
                    <ul className="mt-1.5 space-y-1">
                      {particle.examples.map((ex, i) => (
                        <li key={i} className="text-xs">
                          <span className="font-hanzi">{ex.zh}</span>{" "}
                          <span className="text-zinc-500 dark:text-zinc-400">
                            — {ex.en}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {transError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  {transError}
                </p>
              )}
              {translation && (
                <div className="mt-3 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-sky-600 dark:text-sky-400 mb-0.5">
                    Sentence
                  </div>
                  <div className="font-hanzi text-xs text-zinc-500 dark:text-zinc-400 mb-1 break-all">
                    {findSentenceFor(selection.surface)}
                  </div>
                  <p className="text-sm leading-relaxed">{translation}</p>
                </div>
              )}

              <div className="mt-4 space-y-3 text-sm">
                {loadingLookup && (
                  <p className="text-zinc-500 dark:text-zinc-400">Looking up…</p>
                )}
                {!loadingLookup && lookup?.exact?.length === 0 && !lookup?.related?.length && (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    No dictionary entry found.
                  </p>
                )}
                {lookup?.exact && lookup.exact.length > 0 && (
                  <ul className="space-y-2">
                    {lookup.exact.map((entry, i) => (
                      <li key={i} className="border-l-2 border-emerald-500 pl-3">
                        <div className="text-xs text-zinc-400">
                          {entry.traditional !== entry.simplified && `${entry.traditional} · `}
                          {entry.pinyin}
                        </div>
                        {entry.defs.map((d, j) => (
                          <div key={j} className="leading-relaxed">
                            {d}
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
                {lookup?.related && lookup.related.length > 0 && (
                  <details open={!lookup.exact || lookup.exact.length === 0}>
                    <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">
                      Related words 相关词
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {lookup.related.map(({ surface, entries }) => (
                        <li key={surface} className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-3">
                          <span className="font-hanzi text-base font-medium">{display(surface)}</span>{" "}
                          <span className="text-xs text-zinc-400">{entries[0]?.pinyin}</span>
                          {entries.slice(0, 2).map((entry, j) => (
                            <div key={j} className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                              {entry.defs[0]}
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
