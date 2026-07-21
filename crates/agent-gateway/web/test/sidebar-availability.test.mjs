import assert from "node:assert/strict";
import test from "node:test";

import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

const loader = createWebModuleLoader({
  rootDir: fileURLToPath(new URL("../", import.meta.url)),
});
const {
  INITIAL_GATEWAY_SIDEBAR_STATUS_FRESHNESS,
  reduceGatewaySidebarStatusFreshness,
  shouldDisableGatewaySidebarSections,
} = loader.loadModule("src/app/sidebar/gatewaySidebarAvailability.ts");

test("gateway sidebar sections depend only on the browser gateway transport", () => {
  const cases = [
    {
      name: "connected gateway transport",
      connectionLost: false,
      socketConnected: true,
      expected: false,
    },
    {
      name: "authenticated socket has not connected yet",
      connectionLost: false,
      socketConnected: false,
      expected: true,
    },
    {
      name: "transport lost",
      connectionLost: true,
      socketConnected: true,
      expected: true,
    },
  ];

  for (const entry of cases) {
    assert.equal(
      shouldDisableGatewaySidebarSections({
        connectionLost: entry.connectionLost,
        socketConnected: entry.socketConnected,
      }),
      entry.expected,
      entry.name,
    );
  }
});

test("desktop Agent status no longer gates sidebar transport freshness", () => {
  let freshness = INITIAL_GATEWAY_SIDEBAR_STATUS_FRESHNESS;
  const reduce = (event) => {
    freshness = reduceGatewaySidebarStatusFreshness(freshness, event);
  };

  reduce({ type: "connection", connected: true });
  assert.equal(freshness.socketConnected, true, "socket connection unlocks the sidebar");

  reduce({ type: "status" });
  assert.equal(freshness.socketConnected, true, "Agent status events do not change readiness");

  reduce({ type: "connection", connected: false });
  assert.equal(freshness.socketConnected, false, "socket disconnect locks the sidebar");
});
