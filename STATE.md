# readChinese — Project State

> **Read this file first.** It is the single source of truth for project context,
> decisions, and progress. Update it whenever you finish or start a work item.
> Last updated: 2026-08-24

## What this app is

A single-user Mandarin reading immersion web app. The owner learns Chinese fastest
by reading. Instead of flashcard-first apps (Duolingo style), this drops the user
directly into real Chinese text with:

- Hanzi with **pinyin rendered below each word** (ruby annotations)
- **Tap a word → offline dictionary definition** (CC-CEDICT popup)
- **Tap a sentence → LLM translation** (bring-your-own-key, OpenAI-compatible)
- Auto-built SRS flashcards from every word looked up
- Dashboard tracking coverage of the **top ~1,000 characters** toward a
  **90%-of-text-coverage goal in one month**

## Owner profile

- Student of Mandarin, **elementary level (~200–600 chars known)**, HSK 2–3-ish
- Goal: read 90% of everyday written Chinese within ~30 days
  (= knowing ~900–1,000 unique chars; ~15–25 new chars/day)

## Locked decisions (do not re-litigate without asking owner)

| Decision | Choice |
|---|---|
| Platform | Web app (Next.js App Router + TypeScript + Tailwind) |
| Content | Both: built-in graded library AND paste/import own text |
| Translation | Hybrid: CC-CEDICT offline word lookup + LLM sentence translation |
| LLM setup | Bring-your-own-key (any OpenAI-compatible endpoint), configured in Settings |
| Accounts | None. Single-user local app. No auth. |
| DB | SQLite via Drizzle ORM (`better-sqlite3`), file at `data/app.db` |
| Segmentation | `Intl.Segmenter` (built-in, zh word mode) |
| Pinyin | `pinyin-pro` (tone marks, polyphone handling, tone colors optional) |

## Architecture

```
src/
  app/            Next.js pages: / (dashboard), /library, /read/[id],
                  /review, /vocab, /settings
  app/api/        texts CRUD, texts/[id], lookup, srs, translate, settings,
                  progress (session track), progress/known, review (count+grade)
  lib/
    db.ts         Drizzle client (better-sqlite3) + inline DDL + migrations
    schema.ts     Table definitions
    segment.ts    Intl.Segmenter wrapper: text -> word segments + pinyin
    cedict.ts     CEDICT lookup (exact + related substrings) + numbered→marked pinyin
    settings.ts   Settings table access; LLM config w/ env fallback
    grade.ts      i+1 text grading vs user char set + Jun Da ranks
    stats.ts      Coverage, streak, next targets, auto-known, recommendation
scripts/
  import-cedict.mjs   CC-CEDICT -> vocab (`npm run db:import-cedict`)
  import-freq.mjs     Jun Da list -> char_freq, GBK decoded (`npm run db:import-freq`)
  seed-texts.mjs      Seed 3 starter texts (`npm run db:seed`)
  seed-library.mjs    Seed 30 graded texts A1–D1 (`npm run db:seed-library`)
  mock-llm.mjs        Mock OpenAI-compatible server for keyless testing (:3999)
data/
  app.db        SQLite database (gitignored)
  cedict/       Downloaded CEDICT source file (gitignored)
```

## Data model

- `texts`: id, title, source_url?, raw_body, created_at, stats JSON (pct_new etc.)
- `text_segments`: id, text_id FK, seq, surface, pinyin, type (word|punct|other),
  char_start — precomputed so reader loads instantly
- `vocab`: CEDICT dump — simplified, traditional, pinyin, definitions JSON
  (indexed on simplified)
- `char_progress`: char (PK), exposures, status ('new'|'seen'|'known'), first_seen_at,
  last_seen_at
- `word_srs`: word (PK), interval_days, ease, due_at, taps, source_sentence?
  (Leitner boxes: 1d → 3d → 7d → 16d → 35d)
- `translations_cache`: hash (PK of sentence hash), sentence, translation, model, created_at

## Key algorithms

- **Grading:** unknown_top1000_chars / total_chars per text; recommend texts with ~2–5% unknown ("i+1" zone)
- **Auto-known:** char seen ≥5 times across sessions & never tapped → suggest marking known
- **SRS:** Leitner box schedule above; wrong answer resets to box 0
- **Training wheels:** auto-hide pinyin for chars with status 'known' (toggleable)

## Roadmap

### Week 1 — Reader MVP (complete)
- [x] Scaffold Next.js project (TS, Tailwind, App Router)
- [x] Deps installed: pinyin-pro, drizzle-orm, better-sqlite3 (+drizzle-kit dev)
- [x] Schema + db client (`src/lib/db.ts` runs inline DDL on import)
- [x] CC-CEDICT downloaded & imported into SQLite (124,903 rows) via `npm run db:import-cedict`
- [x] Segmentation + pinyin pipeline (`src/lib/segment.ts`)
- [x] Reader page: segmented hanzi w/ ruby pinyin, tap-word CEDICT popup,
      save-to-review button, pinyin toggle
- [x] Library page: paste text -> saved -> open in reader; list + delete
- [x] Seed texts script: `npm run db:seed` (3 elementary texts)
- [x] Verified: lint clean, tsc clean, `next build` passes, all APIs smoke-tested
      against a running prod server (texts CRUD, lookup 中国→Zhōng guó/China,
      srs upsert, reader SSR HTML shows ruby annotations)

#### Week 1 remaining polish (optional, low priority)
- [ ] Manual browser check of tap-popup UX + bottom-sheet styling
- [ ] Tone-colored pinyin display option (data already supports it)

### Week 2 — Translation layer (complete)
- [x] Settings storage: `settings` table + `src/lib/settings.ts` helper.
      Precedence: DB `llm_*` keys → env (`OPENAI_BASE_URL`/`OPENAI_API_KEY`/
      `OPENAI_MODEL`) → defaults (api.openai.com/v1, gpt-4o-mini)
- [x] `/settings` page (base URL, model, API key; key masked to last 4; clear-key button)
- [x] `/api/settings` GET/PUT/DELETE (never returns full key)
- [x] `/api/translate`: sha256(sentence) cache lookup → OpenAI-compatible
      chat completion (45s timeout, temp 0.2, EN-only system prompt) → cached
- [x] Reader popup: 译整句 Translate button + result card; per-session client cache;
      sentence splitter splits on 。！？；within the tapped word's paragraph
- [x] Saved-vocab list at `/vocab` (word, pinyin, source sentence, due date, box, taps)
- [x] Nav header: 书库 Library / 词汇 Vocab / 设置 Settings
- [x] Verified: lint/tsc/build clean; E2E smoke test with mock LLM
      (`scripts/mock-llm.mjs`, port 3999): translate OK, cache hit OK,
      settings masking OK, vocab+settings pages 200

#### Week 2 remaining polish (optional)
- [ ] Manual browser check of settings form + translate UX
- [ ] Batch-translate whole paragraph option

### Week 3 — Learning loop (complete)
- [x] Jun Da frequency list imported: `npm run db:import-freq` → char_freq
      table, 9,933 chars w/ rank/frequency/pinyin/gloss (GBK decoded)
- [x] Schema: `char_freq`, `activity` (daily read log), `texts.last_opened_at`
      (migrated via PRAGMA check in db.ts)
- [x] POST /api/progress {textId}: upserts exposures++ per distinct hanzi of the
      text, logs activity day, sets last_opened_at. Reader fires it once/mount
      (sessionStorage guard against double-count on back-nav)
- [x] POST /api/progress/known {char, known}: mark/unmark known status
- [x] `src/lib/grade.ts`: i+1 grader — unknown% counts only top-2500-freq chars
      not known and not familiar (exposures ≥3); gradeAllTexts(), scoreGrade()
- [x] `src/lib/stats.ts`: coverage (known vs encountered within top-1000),
      newCharsToday, streak (activity walk-back), nextTargets (top-ranked
      not-yet-known chars), 14-day activity bars, recommendation engine
      (i+1 zone 1–10%, ideal ~4%, penalizes just-opened texts)
- [x] Dashboard at `/` (was redirect): coverage bar (solid known + light
      encountered), daily-target card (20/day), streak card, 14-day sparkline,
      推荐阅读 recommended-next-read card with new-chars preview,
      "next high-frequency characters" grid with one-tap mark-known ✓
- [x] Library difficulty badges: 0%=green, ≤10% blue, ≤25% amber, else red
      ("% new" = unfamiliar distinct chars / distinct chars)
- [x] Graded library seeded: `npm run db:seed-library` → 30 texts across bands
      A1/A2/B1/B2/C1/D1 (idempotent by title; source_url=`graded:<band>`)
- [x] Verified: lint/tsc/build clean; live smoke test — session tracking
      (40 chars tracked), mark-known, dashboard coverage 15→0 after reset,
      recommendation card, library badges. Test data scrubbed afterwards.

#### Week 4 — Retention & polish (complete)
- [x] `/review` page + session: Leitner flashcards from word_srs due queue
      (front: hanzi + source sentence → reveal: pinyin + CEDICT defs via
      /api/lookup); 忘了 Again = box 0 due in 1h, 记住了 Good = next box
      (1d→3d→7d→16d→35d); end-of-session summary
- [x] POST/GET `/api/review` (grade / due count); DueBadge in nav shows due count
- [x] Training wheels: pinyin auto-hidden for chars with status='known'
      (segment hidden iff ALL its chars known); knownChars passed from server;
      "藏已会" toggle to override
- [x] Reader prefs persisted in localStorage (`rc-prefs`): showPinyin,
      hideKnown (default on), toneColors (default off), traditional (default off)
- [x] Tone-colored pinyin: t1 rose / t2 emerald / t3 blue / t4 purple,
      neutral inherits gray; per-syllable spans in ruby rt
- [x] 繁體 traditional display via opencc-js (dynamic import, only when
      toggled; converts title + segments + popup word display)
- [x] .txt upload import in library form (UTF-8; auto-title from filename)
- [x] Dashboard "快认识了吧？" section: chars seen ≥5× suggested for
      mark-known with one-tap ✓ (getAutoKnownCandidates)
- [x] Verified: lint/tsc/build clean; E2E — srs save → backdate → due count 2
      → review page renders cards → grade correct (box 1) / wrong (box 0, 1h)
      → count 0; reader/library/dashboard all 200. Test data scrubbed.

#### Post-MVP backlog (not scheduled — ask owner before starting)
- [ ] Manual browser UX pass (never done in any week)
- [ ] EPUB import; text search/filter in library
- [ ] Review: type-the-pinyin mode; audio (TTS) playback
- [ ] Export/import progress backup

## Data sources (free)

- CC-CEDICT: https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip (CC-BY-SA 4.0)
- Jun Da freq list: https://lingua.mtsu.edu/chinese-computing/statistics/char/download.php?Which=MO
  (mirror if blocked; top 9933 chars, format: rank char frequency pinyin gloss)

## Conventions / gotchas

- No comments in code unless asked (owner preference)
- Do NOT commit secrets; API key lives in DB/env only
- Git repo root is the parent dir (`~/Documents/mycode`) — there are unrelated
  dirty files there; NEVER `git add .` blindly. Stage only files inside
  projects/readChinese, and only when explicitly asked.
- Node v24, npm 11 available.
- **Next.js 16.3.2 specifics (verified against bundled docs):**
  - `params`/`searchParams` are Promises — always `await` (see `read/[id]/page.tsx`)
  - Route handlers are NOT cached by default; `await request.json()` for POSTs
  - Pages reading SQLite must call `await connection()` from `next/server`
    FIRST, or they get prerendered at build time with stale data
    (`library/page.tsx`, `read/[id]/page.tsx` do this)
  - Turbopack is default; no webpack config. `turbopack.root` is set in
    next.config.ts because the git root is the parent workspace dir.
- **pinyin-pro:** option is spelled `toneSandhi` (not toneSandi).
- **Drizzle better-sqlite3:** `db.transaction(fn)` executes eagerly and returns
  fn's return value (it is NOT a factory like raw better-sqlite3).
- DDL exists in THREE places that must stay in sync: `src/lib/db.ts`,
  `scripts/import-cedict.mjs`, `scripts/seed-texts.mjs`.
- Run order after fresh clone: `npm install && npm run db:import-cedict && npm run db:seed && npm run dev`
- **This machine has a global `OPENAI_API_KEY` env var** — sentence translation
  works out-of-the-box via the env fallback (observed a real OpenAI 401 during
  testing when unconfigured, proving env is picked up). The Settings page DB
  values override it.
- **React lint purity rule:** calling `Date.now()` directly inside component
  bodies errors (`react-hooks/purity`). Wrap in a helper fn
  (`currentTimeMs()` in vocab/page.tsx).
- Test LLM integration without a real key: `node scripts/mock-llm.mjs`
  (:3999), then PUT /api/settings baseUrl=http://localhost:3999/v1.
  Clear test settings afterwards with DELETE /api/settings.
- **Smoke tests pollute live stats** — after testing progress endpoints on the
  real DB, scrub: DELETE FROM char_progress; DELETE FROM activity;
  UPDATE texts SET last_opened_at = NULL. (Done after Week 3 testing.)
- `Intl.Segmenter` + `pinyin-pro` logic is duplicated in scripts
  (seed-texts.mjs, seed-library.mjs) because scripts run as plain ESM.
  Keep in sync with src/lib/segment.ts if pipeline changes.
- Drizzle `notExists()` used in stats.ts next-targets query (anti-join).
- Grading window: only chars ranked ≤2500 count as "unknown" targets
  (FREQ_WINDOW in grade.ts); familiar threshold exposures ≥3.
- pinyin-pro `convert()` is tone-format conversion ONLY (num↔symbol), NOT
  simplified↔traditional — S2T uses opencc-js (`OpenCC.Converter({from:'cn',to:'t'})`),
  dynamically imported in reader.tsx so the base bundle stays small.
- React lint purity rule: no `Date.now()` / synchronous setState-in-effect.
  Patterns used: `currentTimeMs()` helper for server comps;
  `queueMicrotask(() => setState(...))` to hydrate localStorage prefs
  without SSR mismatch (reader.tsx).
- Reader prefs live in localStorage key `rc-prefs`; session-tracking guard
  key is `rc-tracked-<textId>` in sessionStorage.

## Session log

- 2026-08-24: Plan finalized with owner via Q&A (see Locked decisions).
- 2026-08-24: Week 1 MVP built & verified end-to-end (server smoke tests pass;
  manual browser check still pending).
- 2026-08-24: Week 2 built & verified (mock-LLM E2E).
- 2026-08-24: Week 3 built & verified. Dashboard at `/`, i+1 recommendations,
  33 texts total (3 seed + 30 graded).
- 2026-08-24: Week 4 built & verified. ALL FOUR ROADMAP WEEKS COMPLETE. The
  full loop works: read with pinyin/tap-define/sentence-translate → chars and
  words tracked → dashboard coverage toward 90% goal → Leitner reviews due
  badge on nav → training wheels hide known pinyin. Remaining work is the
  post-MVP backlog above plus a manual browser UX pass by the owner.
- 2026-08-24: Owner testing live. Reader toolbar labels made bilingual
  (拼音 Pinyin / 藏已会 Hide known / …) — unchecking 拼音 Pinyin = pure hanzi
  mode (existed since Week 1, discoverability was the issue).
- 2026-08-24: Tone display upgraded from boolean to tri-state per owner
  request: prefs.toneMode = 'off' | 'color' | 'line' (localStorage `rc-prefs`,
  auto-migrated from old toneColors key). 'line' = contour symbols
  (¯ ´ ˇ ` per syllable, U+02C9/U+02CA/U+02C7/U+0060, neutral = blank),
  rendered as ONE ruby per character when syllable count matches char count
  so lines align above each hanzi. Toolbar now a 声调 Tone segmented control
  (– / 色 / 线).
- **PORT NOTE:** owner runs another Next app (`reviewtap`) on :3000.
  readChinese dev server now runs on **:3100** (`npx next dev -p 3100`).
  Don't kill :3000. LAN-exposed ports get occasional bot scanner requests in
  logs — harmless for a personal app but don't expose it publicly.
- 2026-08-24: Context-aware lookup + usage help per owner request:
  1) `/api/lookup` accepts `t`(textId)/`p`(para)/`s`(seq) → server rebuilds the
     paragraph from text_segments, finds the tap's char offset, returns
     `ngrams`: every dictionary-valid forward substring (1字..8字, max 6 chips)
     with pinyin+gloss preview. Reader popup shows "Context 上下文" chips;
     clicking re-runs the popup as that n-gram (Save/Translate/Examples follow
     the active chip). 2) `src/lib/particles.ts` — curated instant grammar
     cards for ~26 aspect markers/function words (着=-ing, 了, 过, 得-complement,
     把/被, 起来/下去/完/到 results, 才/就/再…) shown in the popup on match.
  3) `/api/example` POST {word} → LLM generates 2 grammar-aware example
     sentences (zh/pinyin/en), strict-JSON parsed, cached in new
     `examples_cache` table; popup has 例句 Examples (AI) toggle.
     Verified E2E with mock LLM (ngrams + examples + cache hit).
