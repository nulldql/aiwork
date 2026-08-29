import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startAgent } from "../agents.js";
import { buildStatuses, overlapsFromStatuses } from "../status.js";
import { withTempDir, initRepoWithCommit, git } from "./test-utils.js";

test("buildStatuses reports real touched files for each agent, committed and uncommitted", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const agent1 = await startAgent(dir, "agent-1", "main", "authentication");

    await writeFile(join(agent1.path, "committed.ts"), "export {}");
    await git(agent1.path, ["add", "committed.ts"]);
    await git(agent1.path, ["commit", "-q", "-m", "add committed file"]);
    await writeFile(join(agent1.path, "scratch.ts"), "export {}");

    const statuses = await buildStatuses(dir);
    assert.equal(statuses.length, 1);
    assert.deepEqual(statuses[0].touchedFiles.sort(), ["committed.ts", "scratch.ts"]);
    assert.equal(statuses[0].hasUncommittedChanges, true);
    assert.equal(statuses[0].ahead, 1);
  });
});

test("two agents editing the same real file produce a high risk overlap", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await mkdir(join(dir, "src", "user"), { recursive: true });
    await writeFile(join(dir, "src", "user", "UserService.ts"), "export class UserService {}");
    await git(dir, ["add", "-A"]);
    await git(dir, ["commit", "-q", "-m", "add UserService"]);

    const agent1 = await startAgent(dir, "agent-1", "main", "authentication");
    const agent2 = await startAgent(dir, "agent-2", "main", "user profiles");

    await writeFile(join(agent1.path, "src", "user", "UserService.ts"), "export class UserService { login() {} }");
    await writeFile(join(agent2.path, "src", "user", "UserService.ts"), "export class UserService { updateProfile() {} }");

    const statuses = await buildStatuses(dir);
    const overlaps = overlapsFromStatuses(statuses);

    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].risk, "high");
    assert.deepEqual(overlaps[0].sharedFiles, [join("src", "user", "UserService.ts")]);
  });
});

test("buildStatuses reports a missing base branch instead of a misleading clean status", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    await git(dir, ["branch", "feature-base"]);

    const agent = await startAgent(dir, "agent-1", "feature-base");
    await writeFile(join(agent.path, "scratch.ts"), "export {}");

    await git(dir, ["branch", "-D", "feature-base"]);

    const statuses = await buildStatuses(dir);
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0].baseBranchMissing, true);
    assert.equal(statuses[0].ahead, 0);
    assert.equal(statuses[0].behind, 0);
    assert.equal(statuses[0].hasUncommittedChanges, true);
    assert.deepEqual(statuses[0].touchedFiles, ["scratch.ts"]);
  });
});

test("two agents working in unrelated files produce no overlap", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);

    const agent1 = await startAgent(dir, "agent-1", "main");
    const agent2 = await startAgent(dir, "agent-2", "main");

    await mkdir(join(agent1.path, "src", "auth"), { recursive: true });
    await writeFile(join(agent1.path, "src", "auth", "login.ts"), "export {}");
    await mkdir(join(agent2.path, "src", "profile"), { recursive: true });
    await writeFile(join(agent2.path, "src", "profile", "edit.ts"), "export {}");

    const statuses = await buildStatuses(dir);
    const overlaps = overlapsFromStatuses(statuses);
    assert.deepEqual(overlaps, []);
  });
});
