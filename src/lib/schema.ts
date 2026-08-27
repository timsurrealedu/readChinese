import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const texts = sqliteTable("texts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  rawBody: text("raw_body").notNull(),
  hanziCount: integer("hanzi_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  lastOpenedAt: integer("last_opened_at"),
});

export const textSegments = sqliteTable(
  "text_segments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    textId: integer("text_id")
      .notNull()
      .references(() => texts.id, { onDelete: "cascade" }),
    para: integer("para").notNull(),
    seq: integer("seq").notNull(),
    surface: text("surface").notNull(),
    type: text("type").notNull(),
    pinyin: text("pinyin"),
  },
  (t) => [index("idx_segments_text").on(t.textId)]
);

export const vocab = sqliteTable(
  "vocab",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    simplified: text("simplified").notNull(),
    traditional: text("traditional").notNull(),
    pinyin: text("pinyin").notNull(),
    defs: text("defs").notNull(),
  },
  (t) => [
    index("idx_vocab_simplified").on(t.simplified),
    index("idx_vocab_traditional").on(t.traditional),
  ]
);

export const charProgress = sqliteTable("char_progress", {
  char: text("char").primaryKey(),
  exposures: integer("exposures").notNull().default(0),
  status: text("status").notNull().default("new"),
  firstSeenAt: integer("first_seen_at"),
  lastSeenAt: integer("last_seen_at"),
});

export const wordSrs = sqliteTable("word_srs", {
  word: text("word").primaryKey(),
  pinyin: text("pinyin"),
  intervalIndex: integer("interval_index").notNull().default(0),
  dueAt: integer("due_at").notNull(),
  taps: integer("taps").notNull().default(0),
  sourceSentence: text("source_sentence"),
  createdAt: integer("created_at").notNull(),
});

export const translationsCache = sqliteTable("translations_cache", {
  hash: text("hash").primaryKey(),
  sentence: text("sentence").notNull(),
  translation: text("translation").notNull(),
  model: text("model"),
  createdAt: integer("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const charFreq = sqliteTable(
  "char_freq",
  {
    char: text("char").primaryKey(),
    rank: integer("rank").notNull(),
    frequency: integer("frequency").notNull(),
    pinyin: text("pinyin"),
    gloss: text("gloss"),
  },
  (t) => [index("idx_freq_rank").on(t.rank)]
);

export const activity = sqliteTable("activity", {
  day: text("day").primaryKey(),
  events: integer("events").notNull().default(0),
});

export const examplesCache = sqliteTable("examples_cache", {
  word: text("word").primaryKey(),
  data: text("data").notNull(),
  model: text("model"),
  createdAt: integer("created_at").notNull(),
});
