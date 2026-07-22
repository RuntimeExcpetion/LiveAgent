import assert from "node:assert/strict";
import test from "node:test";

import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

const loader = createWebModuleLoader({
  rootDir: fileURLToPath(new URL("../", import.meta.url)),
});
const { ConversationStreamClient } = loader.loadModule(
  "src/lib/chat/stream/conversationStreamClient.ts",
);

test("ConversationStreamClient can deliver local web-only events without a gateway sync", () => {
  const events = [];
  const client = new ConversationStreamClient({
    request() {
      throw new Error("gateway transport should not be used for local events");
    },
  });

  client.subscribe("conversation-1", {
    onEvent(event) {
      events.push(event);
    },
    onReset() {},
    onSync() {},
  });

  client.emitLocalEvent({
    type: "token",
    text: "hello",
    conversation_id: "conversation-1",
    seq: 1,
  });

  assert.deepEqual(events, [
    {
      type: "token",
      text: "hello",
      conversation_id: "conversation-1",
      seq: 1,
    },
  ]);
});
