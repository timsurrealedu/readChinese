#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Database from "better-sqlite3";

const DATA_DIR =
  process.env.READCHINESE_DATA_DIR ?? path.join(process.cwd(), "data");
const CEDICT_DIR = path.join(DATA_DIR, "cedict");
const RAW_PATH = path.join(CEDICT_DIR, "cedict_ts.u8");

const ZIP_URL =
  "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip";
const U8_MIRROR =
  "https://raw.githubusercontent.com/rubberduckling/cedict/master/cedict_ts.u8";

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const file = createWriteStream(dest);
  await pipeline(Readable.fromWeb(res.body), file);
}

function extractZip(zipPath, outDir) {
  try {
    execFileSync("unzip", ["-o", zipPath, "-d", outDir], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function findU8File(dir) {
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".u8")) return path.join(dir, f);
  }
  throw new Error(`No .u8 file found in ${dir}`);
}

function parseCedictLine(line) {
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.*)\/$/);
  if (!m) return null;
  return {
    traditional: m[1],
    simplified: m[2],
    pinyin: m[3],
    defs: m[4].split("/").filter(Boolean),
  };
}

async function ensureRaw() {
  mkdirSync(CEDICT_DIR, { recursive: true });
  if (existsSync(RAW_PATH)) return;

  console.log("Downloading CC-CEDICT...");
  try {
    const zipPath = path.join(CEDICT_DIR, "cedict.zip");
    await download(ZIP_URL, zipPath);
    if (extractZip(zipPath, CEDICT_DIR)) {
      const u8 = findU8File(CEDICT_DIR);
      if (u8 !== RAW_PATH) {
        const { renameSync } = await import("node:fs");
        renameSync(u8, RAW_PATH);
      }
      return;
    }
    console.error("unzip failed/unavailable, trying mirror...");
  } catch (e) {
    console.error(`Zip source failed: ${e.message}`);
  }

  await download(U8_MIRROR, RAW_PATH);
}

async function main() {
  await ensureRaw();
  console.log("Parsing", RAW_PATH);
  const text = await readFile(RAW_PATH, "utf8");
  const rows = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parsed = parseCedictLine(t);
    if (parsed) rows.push(parsed);
  }
  console.log(`Parsed ${rows.length} entries`);

  const db = new Database(path.join(DATA_DIR, "app.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS vocab (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simplified TEXT NOT NULL,
      traditional TEXT NOT NULL,
      pinyin TEXT NOT NULL,
      defs TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vocab_simplified ON vocab (simplified);
    CREATE INDEX IF NOT EXISTS idx_vocab_traditional ON vocab (traditional);
  `);
  db.exec("DELETE FROM vocab;");
  const insert = db.prepare(
    "INSERT INTO vocab (simplified, traditional, pinyin, defs) VALUES (?, ?, ?, ?)"
  );
  const tx = db.transaction((batch) => {
    for (const r of batch)
      insert.run(r.simplified, r.traditional, r.pinyin, JSON.stringify(r.defs));
  });
  const CHUNK = 2000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    tx(rows.slice(i, i + CHUNK));
    process.stdout.write(`\rInserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
  const count = db.prepare("SELECT COUNT(*) AS c FROM vocab").get();
  console.log(`Done. vocab rows: ${count.c}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
