export interface ParticleNote {
  key: string;
  pinyin: string;
  label: string;
  note: string;
  examples: { zh: string; en: string }[];
}

const NOTES: ParticleNote[] = [
  {
    key: "着",
    pinyin: "zhe",
    label: "持续体 · ongoing (-ing)",
    note: "Attached after a verb to mark an action in progress or a continuing state — like English “-ing”.",
    examples: [
      { zh: "他看着电视。", en: "He is watching TV." },
      { zh: "她穿着红色的裙子。", en: "She is wearing a red skirt (state)." },
    ],
  },
  {
    key: "了",
    pinyin: "le",
    label: "完成体 · completed / new situation",
    note: "After a verb: action completed. After sentence end: change of state or new situation. Not exactly past tense!",
    examples: [
      { zh: "我吃了饭。", en: "I have eaten (completed)." },
      { zh: "下雨了。", en: "It started raining (new situation)." },
    ],
  },
  {
    key: "过",
    pinyin: "guo",
    label: "经历体 · past experience",
    note: "After a verb: something has been experienced at least once before (ever / before).",
    examples: [
      { zh: "我去过中国。", en: "I have been to China (before)." },
      { zh: "你吃过北京烤鸭吗？", en: "Have you ever eaten Peking duck?" },
    ],
  },
  {
    key: "得",
    pinyin: "de",
    label: "程度补语 · complement of degree",
    note: "Links a verb/adjective to a comment on HOW it is done: V + 得 + description.",
    examples: [
      { zh: "他说得很快。", en: "He speaks very fast." },
      { zh: "你写得真好！", en: "You write really well!" },
    ],
  },
  {
    key: "的",
    pinyin: "de",
    label: "属格/修饰 · possessive & attributive",
    note: "Links a modifier to a noun: A 的 B = A's B / A-ish B. Also turns adjectives into nouns (红的 = the red one).",
    examples: [
      { zh: "这是我的书。", en: "This is my book." },
      { zh: "我喜欢喝冷的。", en: "I like drinking cold ones." },
    ],
  },
  {
    key: "地",
    pinyin: "de",
    label: "方式副词 · adverbial marker",
    note: "Links an adverbial to a verb: Adv + 地 + V = do V in that manner.",
    examples: [
      { zh: "他慢慢地走。", en: "He walks slowly." },
      { zh: "孩子们开心地笑了。", en: "The children smiled happily." },
    ],
  },
  {
    key: "把",
    pinyin: "bǎ",
    label: "把字句 · disposal construction",
    note: "Moves the object before the verb to emphasize what happens TO it: Subj + 把 + Obj + V + result.",
    examples: [
      { zh: "请把门关上。", en: "Please close the door (shut it fully)." },
      { zh: "我把作业做完了。", en: "I finished doing my homework." },
    ],
  },
  {
    key: "被",
    pinyin: "bèi",
    label: "被动 · passive voice",
    note: "Marks passive: Subj + 被 (+ agent) + V. Often for undesirable events.",
    examples: [
      { zh: "蛋糕被弟弟吃了。", en: "The cake was eaten by (little) brother." },
      { zh: "我的手机被偷了。", en: "My phone got stolen." },
    ],
  },
  {
    key: "吗",
    pinyin: "ma",
    label: "疑问语气 · yes/no question",
    note: "Sentence-final particle turning a statement into a neutral yes/no question.",
    examples: [
      { zh: "你是学生吗？", en: "Are you a student?" },
      { zh: "这个可以吗？", en: "Is this okay?" },
    ],
  },
  {
    key: "呢",
    pinyin: "ne",
    label: "反问/延续 · topical question",
    note: "“And…?” / “What about…?” Also marks ongoing action with 正在……呢.",
    examples: [
      { zh: "你呢？", en: "And you?" },
      { zh: "他在睡觉呢。", en: "He's sleeping (right now)." },
    ],
  },
  {
    key: "吧",
    pinyin: "ba",
    label: "建议/推测 · suggestion & supposition",
    note: "Softens into a suggestion (“let’s…, shall we?”) or an educated guess (“…probably”).",
    examples: [
      { zh: "我们走吧。", en: "Let's go." },
      { zh: "他是老师吧？", en: "He's a teacher, I suppose?" },
    ],
  },
  {
    key: "在",
    pinyin: "zài",
    label: "进行体 · in-progress marker",
    note: "Before a verb: explicitly marks ongoing action (在 + V ≈ be V-ing). Also means 'at/to be located'.",
    examples: [
      { zh: "我在学中文。", en: "I am learning Chinese." },
      { zh: "书在桌子上。", en: "The book is on the table." },
    ],
  },
  {
    key: "会",
    pinyin: "huì",
    label: "将来/能力 · will & learned ability",
    note: "Future likelihood (“will”) or an ability acquired through learning (“can speak…”).",
    examples: [
      { zh: "明天会下雨。", en: "It will rain tomorrow." },
      { zh: "我会说一点中文。", en: "I can speak a little Chinese." },
    ],
  },
  {
    key: "能",
    pinyin: "néng",
    label: "能够 · can (circumstance)",
    note: "Can = enabled by circumstances/ability right now. 能不能 is the common question form.",
    examples: [
      { zh: "今天我不能来。", en: "I can't come today." },
      { zh: "你能帮我一下吗？", en: "Can you help me a bit?" },
    ],
  },
  {
    key: "可以",
    pinyin: "kěyǐ",
    label: "许可 · permission",
    note: "May/can = permitted or feasible. Slightly more polite than 能 for requests.",
    examples: [
      { zh: "这里可以拍照吗？", en: "May I take photos here?" },
      { zh: "你可以说慢一点吗？", en: "Could you speak more slowly?" },
    ],
  },
  {
    key: "想",
    pinyin: "xiǎng",
    label: "意愿 · want to",
    note: "Want to / would like to (before verb). Also 'to think/miss' as standalone verb.",
    examples: [
      { zh: "我想喝水。", en: "I want to drink water." },
      { zh: "我想家了。", en: "I miss home." },
    ],
  },
  {
    key: "要",
    pinyin: "yào",
    label: "将要/想要 · going to & want",
    note: "Stronger than 想: intend/require; before verb also near-future 'going to'. 不要 = don't!",
    examples: [
      { zh: "我要一杯咖啡。", en: "I want a cup of coffee." },
      { zh: "天要黑了。", en: "It's about to get dark." },
    ],
  },
  {
    key: "起来",
    pinyin: "qǐlái",
    label: "趋向补语 · start up / seem like",
    note: "V + 起来: upward motion; starting an action; or “it seems…” after adjectives.",
    examples: [
      { zh: "站起来！该出发了。", en: "Stand up! Time to set off." },
      { zh: "这道菜看起来很好吃。", en: "This dish looks delicious." },
    ],
  },
  {
    key: "下去",
    pinyin: "xiàqu",
    label: "趋向补语 · continue down",
    note: "V + 下去: downward motion, or continuing an action/state ('keep V-ing').",
    examples: [
      { zh: "雨下起来了，别下去了。", en: "It started raining, don't go down." },
      { zh: "你要坚持下去。", en: "You must keep persevering." },
    ],
  },
  {
    key: "完",
    pinyin: "wán",
    label: "结果补语 · finish (V+完)",
    note: "Result complement: V + 完 = finish V-ing completely.",
    examples: [
      { zh: "我吃完了。", en: "I finished eating." },
      { zh: "看完这本书要多久？", en: "How long until you finish this book?" },
    ],
  },
  {
    key: "到",
    pinyin: "dào",
    label: "结果补语 · arrive / succeed (V+到)",
    note: "Result complement: reach/attain. V + 到 = managed to V, caught, received.",
    examples: [
      { zh: "我找到钥匙了。", en: "I found the keys (successfully)." },
      { zh: "你到了给我打电话。", en: "Call me when you arrive." },
    ],
  },
  {
    key: "给",
    pinyin: "gěi",
    label: "给予/被动 · give / for / by",
    note: "Verb 'give'; preposition 'for/to' (给他买 = buy for him); colloquial passive marker like 被.",
    examples: [
      { zh: "请给我一杯水。", en: "Please give me a glass of water." },
      { zh: "我给他买了一本书。", en: "I bought a book for him." },
    ],
  },
  {
    key: "才",
    pinyin: "cái",
    label: "时间副词 · only just / not until",
    note: "Earlier than expected ('already')? No — 才 = later than expected or 'only then'; also small-quantity emphasis.",
    examples: [
      { zh: "他昨天才到。", en: "He didn't arrive until yesterday." },
      { zh: "我才喝了半杯。", en: "I've only drunk half a cup." },
    ],
  },
  {
    key: "就",
    pinyin: "jiù",
    label: "时间副词 · soon / then",
    note: "Sooner than expected ('then/right away'); emphasizes 'as early as' or conclusion from reasoning.",
    examples: [
      { zh: "我马上就去。", en: "I'll go right away." },
      { zh: "他五岁就会游泳了。", en: "He could already swim at age five." },
    ],
  },
  {
    key: "再",
    pinyin: "zài",
    label: "重复 · again (next time)",
    note: "Do again LATER / one more time (future repetition). Compare 又 = again (already happened).",
    examples: [
      { zh: "再说一遍，好吗？", en: "Say it again please?" },
      { zh: "吃完饭再看电视。", en: "Finish eating before watching TV (watch only afterwards)." },
    ],
  },
];

export function getParticleNote(surface: string): ParticleNote | null {
  const s = surface.trim();
  if (!s) return null;
  if (s.length === 1) {
    return NOTES.find((n) => n.key === s) ?? null;
  }
  return NOTES.find((n) => n.key === s) ?? null;
}
