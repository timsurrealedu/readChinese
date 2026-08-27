import type { NextRequest } from "next/server";
import {
  clearLlmSettings,
  getLlmConfig,
  setSetting,
} from "@/lib/settings";

function publicView() {
  const cfg = getLlmConfig();
  return {
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    hasKey: Boolean(cfg.apiKey),
    keyPreview: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : null,
  };
}

export async function GET() {
  return Response.json(publicView());
}

export async function PUT(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { baseUrl, model, apiKey } = (payload ?? {}) as {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };

  if (baseUrl !== undefined) {
    const trimmed = baseUrl.trim();
    if (trimmed.length > 300) {
      return Response.json({ error: "Base URL too long" }, { status: 400 });
    }
    if (trimmed && !/^https?:\/\//.test(trimmed)) {
      return Response.json(
        { error: "Base URL must start with http:// or https://" },
        { status: 400 }
      );
    }
    if (trimmed) setSetting("llm_base_url", trimmed.replace(/\/+$/, ""));
  }

  if (model !== undefined) {
    const trimmed = model.trim();
    if (trimmed.length > 100) {
      return Response.json({ error: "Model name too long" }, { status: 400 });
    }
    if (trimmed) setSetting("llm_model", trimmed);
  }

  if (typeof apiKey === "string" && apiKey.trim().length > 0) {
    if (apiKey.trim().length > 500) {
      return Response.json({ error: "API key too long" }, { status: 400 });
    }
    setSetting("llm_api_key", apiKey.trim());
  }

  return Response.json(publicView());
}

export async function DELETE() {
  clearLlmSettings();
  return Response.json(publicView());
}
