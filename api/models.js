const { resolveProviderApiKey, resolveProviderBaseUrl } = require("./providerEnv.js");

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function modelsUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith("/v1") ? `${normalized}/models` : `${normalized}/v1/models`;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) {
      throw new Error("request body too large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("request body must be valid JSON");
  }
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.models)) return payload.models;
  return [];
}

function normalizeModels(items) {
  const seen = new Set();
  const models = [];
  for (const item of items) {
    const id = String(item?.id || item?.name || item?.model || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({ id });
  }
  return models;
}

module.exports = async function models(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed", message: "Use POST /api/models" });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: "invalid_request", message: error.message });
    return;
  }

  const apiKey = resolveProviderApiKey(body.apiKey);
  if (!apiKey) {
    sendJson(response, 500, {
      error: "missing_api_key",
      message: "Set OPENAI_API_KEY or OPENAI_COMPATIBLE_API_KEY, or pass apiKey in the request.",
    });
    return;
  }

  const baseUrl = normalizeBaseUrl(resolveProviderBaseUrl(body.baseUrl, DEFAULT_BASE_URL).value);
  let upstream;
  try {
    upstream = await fetch(modelsUrl(baseUrl), {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey.value}`,
        "content-type": "application/json",
      },
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "upstream_unavailable",
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const rawText = await upstream.text();
  let payload = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { message: rawText };
  }

  if (!upstream.ok) {
    sendJson(response, upstream.status, {
      error: "upstream_error",
      status: upstream.status,
      message: payload?.error?.message || payload?.message || rawText || upstream.statusText,
    });
    return;
  }

  sendJson(response, 200, {
    models: normalizeModels(extractItems(payload)),
    raw: payload,
  });
};
