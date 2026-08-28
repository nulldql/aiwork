import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startAgent, stopAgent, listAgents, getTasks, mergeAgent, branchNameFor, agentNameFromBranch } from "../agents.js";
import { withTempDir, initRepoWithCommit, git } from "./test-utils.js";

test("branchNameFor and agentNameFromBranch round trip", () => {
  assert.equal(branchNameFor("agent-1"), "aiwork/agent-1");
  assert.equal(agentNameFromBranch("aiwork/agent-1"), "agent-1");
  assert.equal(agentNameFromBranch("main"), null);
});

test("startAgent creates a real worktree, and listAgents finds it with its base and task", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const agent = await startAgent(dir, "agent-1", "main", "authentication");
    assert.equal(agent.branch, "aiwork/agent-1");
    assert.equal(agent.base, "main");

    const agents = await listAgents(dir);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].name, "agent-1");

    const tasks = await getTasks(dir);
    assert.equal(tasks.get("agent-1"), "authentication");
  });
});

test("startAgent defaults the base to the current branch when none is given", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const agent = await startAgent(dir, "agent-1");
    assert.equal(agent.base, "main");
  });
});

test("startAgent refuses to create a second worktree for the same agent name", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await startAgent(dir, "agent-1");
    await assert.rejects(() => startAgent(dir, "agent-1"), /already has a worktree/);
  });
});

test("startAgent rejects a base branch that doesn't exist", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await assert.rejects(() => startAgent(dir, "agent-1", "does-not-exist"), /doesn't exist/);
  });
});

test("stopAgent removes the worktree and clears its state", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await startAgent(dir, "agent-1");
    await stopAgent(dir, "agent-1", false);

    const agents = await listAgents(dir);
    assert.equal(agents.length, 0);
    const tasks = await getTasks(dir);
    assert.equal(tasks.has("agent-1"), false);
  });
});

test("stopAgent throws a clear error for an agent that doesn't exist", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await assert.rejects(() => stopAgent(dir, "ghost", false), /no agent named/);
  });
});

test("multiple agents can run at once with independent worktrees", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await startAgent(dir, "agent-1", "main", "authentication");
    await startAgent(dir, "agent-2", "main", "user profiles");

    const agents = await listAgents(dir);
    assert.equal(agents.length, 2);
    assert.deepEqual(agents.map((a) => a.name).sort(), ["agent-1", "agent-2"]);
  });
});

test("mergeAgent merges a real commit from the agent's branch into the base", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const agent = await startAgent(dir, "agent-1");
    await writeFile(join(agent.path, "feature.ts"), "export const x = 1;");
    await git(agent.path, ["add", "feature.ts"]);
    await git(agent.path, ["commit", "-q", "-m", "add feature"]);

    await mergeAgent(dir, "agent-1");

    const { readFile } = await import("node:fs/promises");
    const content = await readFile(join(dir, "feature.ts"), "utf8");
    assert.equal(content, "export const x = 1;");
  });
});
