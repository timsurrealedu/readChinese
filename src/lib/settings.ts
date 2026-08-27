import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings } from "./schema";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
}

export function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function getLlmConfig(): LlmConfig {
  const baseUrl =
    getSetting("llm_base_url") ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com/v1";
  const apiKey =
    getSetting("llm_api_key") ?? process.env.OPENAI_API_KEY ?? null;
  const model =
    getSetting("llm_model") ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return { baseUrl, apiKey, model };
}

export function clearLlmSettings(): void {
  for (const key of ["llm_base_url", "llm_api_key", "llm_model"]) {
    db.delete(settings).where(eq(settings.key, key)).run();
  }
}
