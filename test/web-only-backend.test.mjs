import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const chat = require("../api/chat.js");
const status = require("../api/status.js");
const models = require("../api/models.js");

class MockRequest extends EventEmitter {
  constructor({ method = "GET", body = "" } = {}) {
    super();
    this.method = method;
    this.body = Buffer.from(body);
  }

  async *[Symbol.asyncIterator]() {
    if (this.body.length > 0) yield this.body;
  }
}

class MockResponse {
  statusCode = 200;
  headers = new Map();
  body = "";

  setHeader(key, value) {
    this.headers.set(key.toLowerCase(), value);
  }

  end(value = "") {
    this.body = String(value);
  }

  json() {
    return JSON.parse(this.body);
  }
}

test("web-only status reports no gateway or desktop relay", async () => {
  const response = new MockResponse();

  await status(new MockRequest(), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    online: true,
    mode: "web-only",
    gateway: false,
    desktopRelay: false,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    openaiBaseUrlSource: process.env.OPENAI_BASE_URL ? "OPENAI_BASE_URL" : "default",
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY),
    apiKeySource: process.env.OPENAI_API_KEY
      ? "OPENAI_API_KEY"
      : process.env.OPENAI_COMPATIBLE_API_KEY
        ? "OPENAI_COMPATIBLE_API_KEY"
        : null,
  });
});

test("web-only chat forwards to an OpenAI-compatible chat completion endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "https://llm.example/v1/";
  process.env.OPENAI_MODEL = "default-model";
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        model: "default-model",
        choices: [{ message: { content: "Hello from the backend" } }],
        usage: { total_tokens: 7 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = new MockResponse();
    await chat(
      new MockRequest({ method: "POST", body: JSON.stringify({ message: "Hello" }) }),
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(captured.url, "https://llm.example/v1/chat/completions");
    assert.equal(captured.init.headers.authorization, "Bearer test-key");
    assert.deepEqual(JSON.parse(captured.init.body), {
      model: "default-model",
      messages: [{ role: "user", content: "Hello" }],
      stream: false,
    });
    assert.equal(response.json().message, "Hello from the backend");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalBaseUrl;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});


test("web-only models proxies OpenAI-compatible model lists", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "https://llm.example/v1/";
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({
        data: [{ id: "gpt-test" }, { id: "gpt-test" }, { id: "gpt-next" }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = new MockResponse();
    await models(new MockRequest({ method: "POST", body: JSON.stringify({}) }), response);

    assert.equal(response.statusCode, 200);
    assert.equal(captured.url, "https://llm.example/v1/models");
    assert.equal(captured.init.headers.authorization, "Bearer test-key");
    assert.deepEqual(response.json().models, [{ id: "gpt-test" }, { id: "gpt-next" }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalBaseUrl;
  }
});


test("web-only chat can use request-provided provider credentials", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalCompatibleKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_COMPATIBLE_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({
        id: "chatcmpl-provider",
        model: "ui-model",
        choices: [{ message: { content: "Provider key works" } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = new MockResponse();
    await chat(
      new MockRequest({
        method: "POST",
        body: JSON.stringify({
          message: "Hello",
          model: "ui-model",
          baseUrl: "https://provider.example/v1/",
          apiKey: "provider-key",
        }),
      }),
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(captured.url, "https://provider.example/v1/chat/completions");
    assert.equal(captured.init.headers.authorization, "Bearer provider-key");
    assert.equal(response.json().message, "Provider key works");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalCompatibleKey === undefined) delete process.env.OPENAI_COMPATIBLE_API_KEY;
    else process.env.OPENAI_COMPATIBLE_API_KEY = originalCompatibleKey;
    if (originalBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalBaseUrl;
  }
});


test("web-only chat accepts Vercel-style VITE provider env names", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalCompatibleKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const originalViteApiKey = process.env.VITE_OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;
  const originalViteBaseUrl = process.env.VITE_OPENAI_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_COMPATIBLE_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  process.env.VITE_OPENAI_API_KEY = "vite-key";
  process.env.VITE_OPENAI_BASE_URL = "https://vite-provider.example/v1/";
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "Vite env works" } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = new MockResponse();
    await chat(
      new MockRequest({ method: "POST", body: JSON.stringify({ message: "Hello" }) }),
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(captured.url, "https://vite-provider.example/v1/chat/completions");
    assert.equal(captured.init.headers.authorization, "Bearer vite-key");
    assert.equal(response.json().message, "Vite env works");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalCompatibleKey === undefined) delete process.env.OPENAI_COMPATIBLE_API_KEY;
    else process.env.OPENAI_COMPATIBLE_API_KEY = originalCompatibleKey;
    if (originalViteApiKey === undefined) delete process.env.VITE_OPENAI_API_KEY;
    else process.env.VITE_OPENAI_API_KEY = originalViteApiKey;
    if (originalBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalBaseUrl;
    if (originalViteBaseUrl === undefined) delete process.env.VITE_OPENAI_BASE_URL;
    else process.env.VITE_OPENAI_BASE_URL = originalViteBaseUrl;
  }
});
