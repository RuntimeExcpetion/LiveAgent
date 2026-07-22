import assert from "node:assert/strict";
import test from "node:test";

import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

function loadGatewayBaseUrl(env = {}, location = {}) {
  globalThis.__viteImportMetaEnv = env;
  globalThis.window = {
    location: {
      origin: location.origin ?? "https://live-agent-qv8s.vercel.app",
      protocol: location.protocol ?? "https:",
      href: location.href ?? "https://live-agent-qv8s.vercel.app/",
    },
  };

  const loader = createWebModuleLoader({
    rootDir: fileURLToPath(new URL("../", import.meta.url)),
  });
  return loader.loadModule("src/lib/gatewayBaseUrl.ts");
}

test("gateway WebSocket origin uses WSS on HTTPS pages", () => {
  const { getGatewayWebSocketOrigin } = loadGatewayBaseUrl();

  assert.equal(getGatewayWebSocketOrigin(), "wss://live-agent-qv8s.vercel.app");
});

test("gateway origins upgrade configured HTTP gateway on HTTPS pages", () => {
  const { getGatewayHttpOrigin, getGatewayWebSocketOrigin } = loadGatewayBaseUrl({
    VITE_LIVEAGENT_GATEWAY_URL: "http://live-agent-qv8s.vercel.app/",
  });

  assert.equal(getGatewayHttpOrigin(), "https://live-agent-qv8s.vercel.app");
  assert.equal(getGatewayWebSocketOrigin(), "wss://live-agent-qv8s.vercel.app");
});

test("gateway WebSocket origin can use WS on HTTP pages for local development", () => {
  const { getGatewayWebSocketOrigin } = loadGatewayBaseUrl(
    { VITE_LIVEAGENT_GATEWAY_URL: "http://localhost:8080" },
    { origin: "http://localhost:5173", protocol: "http:", href: "http://localhost:5173/" },
  );

  assert.equal(getGatewayWebSocketOrigin(), "ws://localhost:8080");
});
