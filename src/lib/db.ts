import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DATA_DIR =
  process.env.READCHINESE_DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(path.join(DATA_DIR, "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS texts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source_url TEXT,
  raw_body TEXT NOT NULL,
  hanzi_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS text_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  para INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  surface TEXT NOT NULL,
  type TEXT NOT NULL,
  pinyin TEXT
);
CREATE INDEX IF NOT EXISTS idx_segments_text ON text_segments (text_id);
CREATE TABLE IF NOT EXISTS vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simplified TEXT NOT NULL,
  traditional TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  defs TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vocab_simplified ON vocab (simplified);
CREATE INDEX IF NOT EXISTS idx_vocab_traditional ON vocab (traditional);
CREATE TABLE IF NOT EXISTS char_progress (
  char TEXT PRIMARY KEY,
  exposures INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  first_seen_at INTEGER,
  last_seen_at INTEGER
);
CREATE TABLE IF NOT EXISTS word_srs (
  word TEXT PRIMARY KEY,
  pinyin TEXT,
  interval_index INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL,
  taps INTEGER NOT NULL DEFAULT 0,
  source_sentence TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS translations_cache (
  hash TEXT PRIMARY KEY,
  sentence TEXT NOT NULL,
  translation TEXT NOT NULL,
  model TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS char_freq (
  char TEXT PRIMARY KEY,
  rank INTEGER NOT NULL,
  frequency INTEGER NOT NULL,
  pinyin TEXT,
  gloss TEXT
);
CREATE INDEX IF NOT EXISTS idx_freq_rank ON char_freq(rank);
CREATE TABLE IF NOT EXISTS activity (
  day TEXT PRIMARY KEY,
  events INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS examples_cache (
  word TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  model TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_analysis_cache (
  cache_key TEXT PRIMARY KEY,
  text_id INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  analysis_kind TEXT NOT NULL,
  result_json TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reader_analysis_text ON reader_analysis_cache (text_id, paragraph_index);
`);

const textsCols = sqlite.prepare("PRAGMA table_info(texts)").all() as {
  name: string;
}[];
if (!textsCols.some((c) => c.name === "last_opened_at")) {
  sqlite.exec("ALTER TABLE texts ADD COLUMN last_opened_at INTEGER");
}

export const db = drizzle(sqlite, { schema });
