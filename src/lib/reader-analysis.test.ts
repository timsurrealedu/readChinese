import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichReadingAnalysis,
  splitSentences,
  validateReadingResponse,
} from "./reader-analysis.ts";

test("splitSentences preserves punctuation, whitespace, and exact source", () => {
  const source = "你好！  我在办公室。\tReally? 123\n";
  const sentences = splitSentences(source);
  assert.deepEqual(sentences, ["你好！  ", "我在办公室。\t", "Really? ", "123\n"]);
  assert.equal(sentences.join(""), source);
  assert.deepEqual(splitSentences("……？！  好"), ["……？！  ", "好"]);
  assert.deepEqual(splitSentences(""), []);
});

test("validateReadingResponse accepts variable word lengths that reconstruct exactly", () => {
  const source = "人在人办公室。";
  const response = {
    sentences: [{
      source,
      translation: "A person is in the office.",
      segments: [
        { surface: "人", type: "word", contextualGloss: "person" },
        { surface: "在", type: "word", contextualGloss: "is in" },
        { surface: "人办公室", type: "word", contextualGloss: "human office" },
        { surface: "。", type: "other", contextualGloss: null },
      ],
    }],
  };
  assert.deepEqual(validateReadingResponse(source, response), response);
});

test("validateReadingResponse rejects altered, missing, duplicated, or reordered text", () => {
  const make = (surfaces: string[]) => ({ sentences: [{
    source: "我很好。",
    translation: "I am well.",
    segments: surfaces.map((surface) => ({ surface, type: "word", contextualGloss: "x" })),
  }] });
  for (const surfaces of [["我", "好。"], ["我", "很", "很", "好。"], ["很", "我", "好。"], ["我", "狠", "好。"]]) {
    assert.throws(() => validateReadingResponse("我很好。", make(surfaces)));
  }
});

test("enrichReadingAnalysis generates pinyin locally and leaves non-Hanzi unchanged", () => {
  const validated = validateReadingResponse("办公室 OK 123。", {
    sentences: [{
      source: "办公室 OK 123。",
      translation: "The office is OK.",
      segments: [
        { surface: "办公室", type: "word", contextualGloss: "office" },
        { surface: " OK 123。", type: "other", contextualGloss: null },
      ],
    }],
  });
  const result = enrichReadingAnalysis(2, validated);
  assert.equal(result.sentences[0].segments[0].pinyin, "bàn gōng shì");
  assert.equal(result.sentences[0].segments[1].pinyin, null);
  assert.equal(result.sentences.map((s) => s.segments.map((x) => x.surface).join("")).join(""), "办公室 OK 123。");
});

test("pinyin-pro preserves neutral tones", () => {
  const validated = validateReadingResponse("妈妈的。", {
    sentences: [{
      source: "妈妈的。",
      translation: "Mom's.",
      segments: [
        { surface: "妈妈的", type: "word", contextualGloss: "mom's" },
        { surface: "。", type: "other", contextualGloss: null },
      ],
    }],
  });
  assert.equal(enrichReadingAnalysis(0, validated).sentences[0].segments[0].pinyin, "mā ma de");
});
