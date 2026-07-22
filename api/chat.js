const { resolveProviderApiKey, resolveProviderBaseUrl } = require("./providerEnv.js");

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

function writeSse(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function readChoiceDelta(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const delta = choice?.delta ?? choice?.message ?? {};
  const content =
    typeof delta?.content === "string"
      ? delta.content
      : typeof choice?.text === "string"
        ? choice.text
        : "";
  const thinking =
    typeof delta?.reasoning_content === "string"
      ? delta.reasoning_content
      : typeof delta?.reasoning === "string"
        ? delta.reasoning
        : typeof delta?.thinking === "string"
          ? delta.thinking
          : "";
  return { content, thinking };
}

async function streamUpstreamResponse(upstreamResponse, response) {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-cache, no-transform");
  response.setHeader("connection", "keep-alive");

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of upstreamResponse.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") {
        writeSse(response, "done", {});
        response.end();
        return;
      }
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      const { content, thinking } = readChoiceDelta(payload);
      if (thinking) writeSse(response, "thinking", { text: thinking });
      if (content) writeSse(response, "token", { text: content });
    }
  }

  writeSse(response, "done", {});
  response.end();
}

module.exports = async function chat(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "method_not_allowed", message: "Use POST /api/chat" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (_error) {
    sendJson(response, 400, { error: "invalid_json", message: "Request body must be JSON." });
    return;
  }

  const apiKey = resolveProviderApiKey(body.apiKey);
  if (!apiKey) {
    sendJson(response, 500, {
      error: "missing_api_key",
      message: "Set OPENAI_API_KEY or OPENAI_COMPATIBLE_API_KEY on the deployment, or configure a provider API key in the WebUI.",
    });
    return;
  }

  const messages = normalizeMessages(body.messages, body.message ?? body.prompt);
  if (messages.length === 0) {
    sendJson(response, 400, { error: "missing_message", message: "Provide message, prompt, or messages." });
    return;
  }

  const baseUrl = resolveProviderBaseUrl(body.baseUrl).value.replace(/\/+$/, "");
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey.value}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
      stream: body.stream === true,
    }),
  });

  if (upstreamResponse.ok && body.stream === true && upstreamResponse.body) {
    await streamUpstreamResponse(upstreamResponse, response);
    return;
  }

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
