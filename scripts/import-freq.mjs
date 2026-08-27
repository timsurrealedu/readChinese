#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Database from "better-sqlite3";

const DATA_DIR =
  process.env.READCHINESE_DATA_DIR ?? path.join(process.cwd(), "data");
const FREQ_PATH = path.join(DATA_DIR, "junda.txt");
const URL =
  "https://lingua.mtsu.edu/chinese-computing/statistics/char/download.php?Which=MO";

async function ensureRaw() {
  if (existsSync(FREQ_PATH)) return;
  console.log("Downloading Jun Da frequency list...");
  mkdirSync(DATA_DIR, { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`);
  const file = createWriteStream(FREQ_PATH);
  await pipeline(Readable.fromWeb(res.body), file);
}

async function main() {
  await ensureRaw();
  const gbk = new TextDecoder("gb18030");
  const buf = await readFile(FREQ_PATH);
  const text = gbk.decode(buf);

  const rows = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("/*")) continue;
    const parts = line.trim().split("\t");
    if (parts.length < 4) continue;
    const [rankS, char, freqS, pinyin, ...glossParts] = parts;
    if (!/^\d+$/.test(rankS)) continue;
    rows.push({
      rank: Number(rankS),
      char,
      frequency: Number(freqS.replace(/\s/g, "")) || 0,
      pinyin: pinyin ?? null,
      gloss: glossParts.join("/") || null,
    });
  }
  console.log(`Parsed ${rows.length} chars`);

  const db = new Database(path.join(DATA_DIR, "app.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS char_freq (
      char TEXT PRIMARY KEY,
      rank INTEGER NOT NULL,
      frequency INTEGER NOT NULL,
      pinyin TEXT,
      gloss TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_freq_rank ON char_freq(rank);
  `);
  db.exec("DELETE FROM char_freq;");
  const insert = db.prepare(
    "INSERT INTO char_freq (char, rank, frequency, pinyin, gloss) VALUES (?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((batch) => {
    for (const r of batch)
      insert.run(r.char, r.rank, r.frequency, r.pinyin, r.gloss);
  });
  for (let i = 0; i < rows.length; i += 2000) {
    tx(rows.slice(i, i + 2000));
  }
  const top = db
    .prepare("SELECT COUNT(*) AS c FROM char_freq WHERE rank <= 1000")
    .get();
  console.log(`Done. char_freq rows: ${rows.length}, top-1000: ${top.c}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
