import assert from "node:assert/strict";
import test from "node:test";
import { analysisCacheKey, analyzeReading } from "./reader-analysis-service.ts";

const cfg = { baseUrl: "https://example.test/v1", apiKey: "test", model: "model-a" };

test("analysis cache key changes with source, model, or kind", () => {
  const base = analysisCacheKey("你好", "model-a", "reading");
  assert.notEqual(base, analysisCacheKey("您好", "model-a", "reading"));
  assert.notEqual(base, analysisCacheKey("你好", "model-b", "reading"));
  assert.notEqual(base, analysisCacheKey("你好", "model-a", "paragraph_translation"));
});

test("malformed reading output is retried once and pinyin is generated locally", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests++;
    const content = requests === 1
      ? JSON.stringify({ sentences: [{ source: "您好。", translation: "Hello.", segments: [{ surface: "你", type: "word", contextualGloss: "you" }] }] })
      : JSON.stringify({ sentences: [{ source: "您好。", translation: "Hello.", segments: [{ surface: "您好", type: "word", contextualGloss: "hello" }, { surface: "。", type: "other", contextualGloss: null }] }] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  const result = await analyzeReading("您好。", 3, cfg, fetcher as typeof fetch);
  assert.equal(requests, 2);
  assert.equal(result.sentences[0].segments[0].pinyin, "nín hǎo");
});

test("malformed reading output fails after one retry", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests++;
    return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
  };
  await assert.rejects(analyzeReading("你好。", 0, cfg, fetcher as typeof fetch));
  assert.equal(requests, 2);
});
