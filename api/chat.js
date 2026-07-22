function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function normalizeMessages(value, fallbackPrompt) {
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((message) => ({
        role: typeof message?.role === "string" ? message.role : "user",
        content: typeof message?.content === "string" ? message.content : String(message?.content ?? ""),
      }))
      .filter((message) => message.content.trim());
  }
  const prompt = typeof fallbackPrompt === "string" ? fallbackPrompt.trim() : "";
  return prompt ? [{ role: "user", content: prompt }] : [];
}

module.exports = async function chat(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "method_not_allowed", message: "Use POST /api/chat" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || "";
  if (!apiKey.trim()) {
    sendJson(response, 500, {
      error: "missing_api_key",
      message: "Set OPENAI_API_KEY or OPENAI_COMPATIBLE_API_KEY on the deployment.",
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (_error) {
    sendJson(response, 400, { error: "invalid_json", message: "Request body must be JSON." });
    return;
  }

  const messages = normalizeMessages(body.messages, body.message ?? body.prompt);
  if (messages.length === 0) {
    sendJson(response, 400, { error: "missing_message", message: "Provide message, prompt, or messages." });
    return;
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
      stream: false,
    }),
  });

  const upstreamText = await upstreamResponse.text();
  let upstreamJson = null;
  try {
    upstreamJson = upstreamText ? JSON.parse(upstreamText) : null;
  } catch (_error) {
    // Keep the raw upstream text below.
  }

  if (!upstreamResponse.ok) {
    sendJson(response, upstreamResponse.status, {
      error: "upstream_error",
      status: upstreamResponse.status,
      message: upstreamJson?.error?.message || upstreamText || "OpenAI-compatible API request failed.",
      upstream: upstreamJson,
    });
    return;
  }

  const content = upstreamJson?.choices?.[0]?.message?.content ?? "";
  sendJson(response, 200, {
    id: upstreamJson?.id ?? null,
    model: upstreamJson?.model ?? model,
    message: content,
    choices: upstreamJson?.choices ?? [],
    usage: upstreamJson?.usage ?? null,
  });
};
