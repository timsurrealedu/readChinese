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

const LIBRARY = [
  ["A1", "你好", `你好！我叫安娜。我是学生。\n很高兴认识你。`],
  ["A1", "谢谢", `这是你的书吗？\n是的，谢谢你！\n不客气。`],
  ["A1", "我的猫", `我有一只小猫。它很可爱。\n它喜欢睡觉，也喜欢玩。`],
  ["A1", "一二三", `我有三个苹果。你有几个？\n我有两个。我们一起吃吧！`],
  ["A2", "今天星期几", `今天星期一，我要去学校。\n明天星期二，我去图书馆看书。`],
  ["A2", "喝水", `我很渴，想喝一杯水。\n你要喝茶还是咖啡？\n请给我一杯热水，谢谢。`],
  ["A2", "我的房间", `我的房间里有一张桌子、一把椅子和一张床。\n桌子上有一台电脑和很多书。`],
  ["A2", "几点了", `现在几点？\n八点半了。我们快走吧！`],
  ["B1", "买水果", `苹果多少钱一斤？\n五块钱一斤。\n太贵了，便宜一点吧。\n好，四块，你要多少？`],
  ["B1", "坐公交车", `我每天都坐公交车去上班。\n车上人很多，但是我不介意。\n我喜欢在车上看窗外的风景。`],
  ["B1", "打电话", `喂，你现在在哪儿？\n我在家写作业呢。\n好，那我一个小时以后给你打电话。`],
  ["B1", "周末计划", `这个周末你打算做什么？\n我想去爬山，听说那座山很漂亮。\n太好了，我可以和你一起去吗？`],
  ["B1", "学游泳", `我想学游泳，可是有点儿怕水。\n别担心，我教你。\n我们先从浅水的地方开始练习。`],
  ["B2", "中国菜", `中国菜很好吃，但是每个地方的味道都不一样。\n四川菜很辣，广东菜比较清淡。\n我最喜欢吃饺子，特别是过年的时候，全家人一起包饺子。`],
  ["B2", "天气", `今天的天气怎么样？\n早上还有太阳，下午可能会下雨。\n那你记得带伞。最近这里的天气变化很快。`],
  ["B2", "在银行", `我想开一个银行账户，需要什么材料？\n请给我看一下你的护照和签证。\n好的，都在这里。办这个手续要多长时间？\n大概二十分钟。`],
  ["B2", "迷路了", `对不起，请问地铁站怎么走？\n你走错方向了，应该往回走，然后在红绿灯那儿往左拐。\n太感谢了！\n没关系，不远，五分钟就到了。`],
  ["B2", "搬家", `下个月我要搬家了，新房子离公司很近。\n恭喜你！需要帮忙吗？\n好啊，到时候请你吃饭。`],
  ["C1", "网购", `现在很多人喜欢在网上买东西，因为又方便又便宜。\n不过，网上购物也有问题：有时候东西和照片不一样。\n所以我买东西之前，都会先看看别人的评价。`],
  ["C1", "锻炼身体", `医生说，每天锻炼三十分钟能让人更健康。\n跑步、游泳、骑车都可以。\n我觉得最重要的是坚持，一个星期至少要运动三次。`],
  ["C1", "面试", `面试的时候，经理问了我很多问题。\n他问我为什么想来这家公司工作。\n我告诉他，我对这份工作很有兴趣，而且我有相关的经验。\n一个星期以后，他们通知我被录取了。`],
  ["C1", "环保", `保护环境是我们每个人的责任。\n我们可以少用塑料袋，出门自己带杯子。\n虽然这些都是小事，但是如果每个人都这样做，世界会变得更美好。`],
  ["C1", "旅行计划", `今年夏天，我打算去云南旅行。\n听说那里四季如春，风景特别美。\n我准备先去昆明，然后去大理和丽江。\n希望我能看到雪山。`],
  ["D1", "手机与生活", `智能手机改变了我们的生活：付钱、点外卖、叫出租车都可以用手机完成。\n有人说这样生活更方便了，也有人觉得我们看手机的时间太多了。\n你怎么看？`],
  ["D1", "学习的方法", `很多人觉得学习外语很难，其实方法很重要。\n只背单词是不够的，你需要在真实的文章里见到这些词。\n读得越多，认识得越多；认识得越多，读得越快。这是一个良性循环。`],
  ["D1", "城市与乡村", `大城市有很多机会，工资也比较高，可是房价贵、空气不太好。\n乡村的生活安静、空气新鲜，但是找工作不容易。\n越来越多的年轻人选择回到家乡发展，因为他们相信家乡的未来。`],
  ["D1", "一杯咖啡的故事", `这家咖啡馆开在一条安静的小街上，老板是一位六十多岁的爷爷。\n他说，开店不是为了赚钱，而是为了认识不同的人。\n每天都有客人来跟他聊天，讲自己的故事。\n对很多人来说，这里不只是一间店，更像一个温暖的家。`],
  ["D1", "传统节日", `春节是中国最重要的传统节日。\n每年这个时候，在外地工作和学习的人都会回家和家人团聚。\n除夕晚上，全家一边吃年夜饭，一边看春晚，孩子们还能拿到红包。\n虽然现在的年味儿淡了一些，但团圆的意义从来没有变过。`],
  ["D1", "人工智能", `人工智能正在改变很多行业：翻译、开车、看病……\n有人担心机器会取代人的工作，也有人认为新技术总会创造新的机会。\n可以肯定的是，学会跟新技术合作的人，未来会有更多的选择。`],
  ["D1", "第一次做饭", `上大学以前，我从来没做过饭。\n上个星期天，我决定自己做一顿饭：西红柿炒鸡蛋。\n虽然样子不太好看，味道也一般，但是爸爸妈妈都说我做得很好。\n我知道他们是在鼓励我，不过我心里还是很高兴。`],
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

  const exists = db.prepare("SELECT 1 FROM texts WHERE title = ?");
  const insertText = db.prepare(
    "INSERT INTO texts (title, source_url, raw_body, hanzi_count, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const insertSeg = db.prepare(
    "INSERT INTO text_segments (text_id, para, seq, surface, type, pinyin) VALUES (?, ?, ?, ?, ?, ?)"
  );

  let added = 0;
  for (const [band, title, body] of LIBRARY) {
    if (exists.get(title)) continue;
    const segs = buildSegments(body);
    let hanziCount = 0;
    for (const ch of body) if (CJK_RE.test(ch)) hanziCount++;
    db.transaction(() => {
      const info = insertText.run(title, `graded:${band}`, body, hanziCount, Date.now());
      const textId = Number(info.lastInsertRowid);
      for (const s of segs)
        insertSeg.run(textId, s.para, s.seq, s.surface, s.type, s.pinyin);
    })();
    added++;
    console.log(`Seeded [${band}] "${title}" (${hanziCount} hanzi)`);
  }
  console.log(`Done. ${added} new texts.`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
