#!/usr/bin/env node
import http from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 3999);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url?.endsWith("/chat/completions")) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "missing bearer" } }));
        return;
      }
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {}
      const userMsg =
        body.messages?.filter((m) => m.role === "user").at(-1)?.content ?? "?";
      const sys = body.messages?.find((m) => m.role === "system")?.content ?? "";
      const content = sys.includes("teaching assistant")
        ? `[{"zh":"他看着电视。","pinyin":"tā kànzhe diànshì.","en":"He is watching TV."},{"zh":"她笑着回答。","pinyin":"tā xiàozhe huídá.","en":"She answered with a smile."}]`
        : `[MOCK] Translation of: ${userMsg}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "mock-1",
          model: body.model ?? "mock",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        })
      );
    });
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`mock LLM on :${PORT}`));
