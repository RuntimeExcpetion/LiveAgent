import assert from "node:assert/strict";
import test from "node:test";

import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

test("managed process store resolves without opening gateway sockets when disabled", async () => {
  globalThis.__viteImportMetaEnv = { VITE_DISABLE_MANAGED_PROCESS: "1" };
  let backendCalled = false;
  const loader = createWebModuleLoader({
    rootDir: fileURLToPath(new URL("../", import.meta.url)),
    mocks: {
      react: {
        useSyncExternalStore(_subscribe, getSnapshot) {
          return getSnapshot();
        },
      },
      [fileURLToPath(new URL("../src/lib/managed-process/backend.ts", import.meta.url))]: {
        backend: {
          fetchState() {
            backendCalled = true;
            throw new Error("backend should not be called");
          },
          subscribe() {
            backendCalled = true;
            return () => {};
          },
        },
      },
    },
  });
  const store = loader.loadModule("src/lib/managed-process/store.ts");

  await store.ensureManagedProcessInit();

  assert.equal(backendCalled, false);
  assert.deepEqual(store.getManagedProcessState(), {
    ready: true,
    agentOnline: false,
    revision: 0,
    processes: [],
  });
});
