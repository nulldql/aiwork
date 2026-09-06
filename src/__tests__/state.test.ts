import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readState, writeState, withStateLock } from "../state.js";
import { withTempDir } from "./test-utils.js";

test("readState returns an empty object when the file doesn't exist yet", async () => {
  await withTempDir(async (dir) => {
    const state = await readState(join(dir, "state.json"));
    assert.deepEqual(state, {});
  });
});

test("writeState and readState round trip real data", async () => {
  await withTempDir(async (dir) => {
    const statePath = join(dir, "nested", "state.json");
    await writeState(statePath, { "agent-1": { base: "main", task: "auth" } });
    const state = await readState(statePath);
    assert.deepEqual(state, { "agent-1": { base: "main", task: "auth" } });
  });
});

test("withStateLock serializes concurrent read-modify-write cycles instead of losing an update", async () => {
  await withTempDir(async (dir) => {
    const statePath = join(dir, "state.json");
    await writeState(statePath, {});

    async function addAgent(name: string): Promise<void> {
      await withStateLock(statePath, async () => {
        const state = await readState(statePath);
        await new Promise((resolve) => setTimeout(resolve, 20));
        state[name] = { base: "main" };
        await writeState(statePath, state);
      });
    }

    await Promise.all([addAgent("agent-1"), addAgent("agent-2"), addAgent("agent-3")]);

    const finalState = await readState(statePath);
    assert.deepEqual(Object.keys(finalState).sort(), ["agent-1", "agent-2", "agent-3"]);
  });
});

test("readState never observes a torn or empty write while writeState is hammered concurrently", async () => {
  await withTempDir(async (dir) => {
    const statePath = join(dir, "state.json");
    const bigState: Record<string, { base: string; task?: string }> = {};
    for (let i = 0; i < 200; i++) bigState[`agent-${i}`] = { base: "main", task: `task number ${i} with some extra length` };
    await writeState(statePath, bigState);

    let stopped = false;
    let reads = 0;

    async function hammerWriter(): Promise<void> {
      while (!stopped) {
        await writeState(statePath, bigState);
        await writeState(statePath, {});
      }
    }

    async function hammerReader(): Promise<void> {
      try {
        for (let i = 0; i < 500 && !stopped; i++) {
          const state = await readState(statePath);
          assert.ok(typeof state === "object" && state !== null);
          reads++;
        }
      } finally {
        stopped = true;
      }
    }

    await Promise.all([hammerWriter(), hammerWriter(), hammerReader(), hammerReader()]);
    assert.ok(reads > 0);
  });
});

test("withStateLock releases the lock even if the callback throws", async () => {
  await withTempDir(async (dir) => {
    const statePath = join(dir, "state.json");

    await assert.rejects(
      () =>
        withStateLock(statePath, async () => {
          throw new Error("boom");
        }),
      /boom/,
    );

    await withStateLock(statePath, async () => {
      const state = await readState(statePath);
      assert.deepEqual(state, {});
    });
  });
});
