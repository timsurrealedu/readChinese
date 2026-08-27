#!/usr/bin/env node
import path from "node:path";
import Database from "better-sqlite3";
import { pinyin } from "pinyin-pro";

const DATA_DIR =
  process.env.READCHINESE_DATA_DIR ?? path.join(process.cwd(), "data");

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function wordPinyin(word) {
  try {
    return pinyin(word, {
      toneType: "symbol",
      type: "string",
      toneSandhi: true,
      nonZh: "consecutive",
      separator: " ",
    });
  } catch {
    return "";
  }
}

function buildSegments(body) {
  const all = [];
  body.split(/\r?\n/).forEach((line, para) => {
    let seq = 0;
    for (const data of segmenter.segment(line)) {
      const surface = data.segment;
      if (!surface) continue;
      const hanzi = (data.isWordLike ?? false) && CJK_RE.test(surface);
      all.push({
        para,
        seq: seq++,
        surface,
        type: hanzi ? "hanzi" : "other",
        pinyin: hanzi ? wordPinyin(surface) : null,
      });
    }
  });
  return all;
}

const SEED_TEXTS = [
  {
    title: "我的家",
    body: `我叫小明。我的家很小，但是很温暖。
我家有四个人：爸爸、妈妈、妹妹和我。爸爸是老师，妈妈是医生。妹妹今年八岁，她很喜欢画画。
每天晚上，我们一起吃晚饭，一起看电视。周末的时候，我们去公园散步。我爱我的家。`,
  },
  {
    title: "在超市买东西",
    body: `今天下午，我和妈妈一起去超市买东西。
超市里的人很多。我们先拿了苹果、香蕉和牛奶。妈妈问："你还想要什么？"我说："我想要巧克力。"
妈妈说："巧克力的糖太多，对身体不好。"最后我们买了一些鸡蛋、面条和绿茶。
回家的路上，我很高兴，因为晚饭我要吃我最喜欢的面条！`,
  },
  {
    title: "学中文的日子",
    body: `学习中文很有意思，也很难。
刚开始的时候，我只认识几个汉字。现在，我已经认识两百多个字了。虽然声调很难，但是我每天都练习读书。
我觉得，学语言最好的方法就是多读、多听、多说。如果你每天读一点，一个月以后，你就会发现很大的进步。
加油！你一定可以做到。`,
  },
];

async function main() {
  const db = new Database(path.join(DATA_DIR, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
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
  `);

  const existing = db.prepare("SELECT COUNT(*) AS c FROM texts").get();
  if (existing.c > 0) {
    console.log(`texts table already has ${existing.c} rows; skipping seed.`);
    db.close();
    return;
  }

  const insertText = db.prepare(
    "INSERT INTO texts (title, source_url, raw_body, hanzi_count, created_at) VALUES (?, NULL, ?, ?, ?)"
  );
  const insertSeg = db.prepare(
    "INSERT INTO text_segments (text_id, para, seq, surface, type, pinyin) VALUES (?, ?, ?, ?, ?, ?)"
  );

  for (const t of SEED_TEXTS) {
    const segs = buildSegments(t.body);
    let hanziCount = 0;
    for (const ch of t.body) if (CJK_RE.test(ch)) hanziCount++;
    const tx = db.transaction(() => {
      const info = insertText.run(t.title, t.body, hanziCount, Date.now());
      const textId = Number(info.lastInsertRowid);
      for (const s of segs)
        insertSeg.run(textId, s.para, s.seq, s.surface, s.type, s.pinyin);
    });
    tx();
    console.log(`Seeded "${t.title}" (${segs.length} segments, ${hanziCount} hanzi)`);
  }
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
