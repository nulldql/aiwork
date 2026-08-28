import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isGitRepo,
  repoRoot,
  currentBranch,
  listWorktrees,
  addWorktree,
  removeWorktree,
  diffNameOnly,
  statusPorcelain,
  aheadBehind,
  mergeBranch,
  branchExists,
} from "../git.js";
import { withTempDir, initRepoWithCommit, git } from "./test-utils.js";

test("isGitRepo distinguishes a real repo from a plain directory", async () => {
  await withTempDir(async (dir) => {
    assert.equal(await isGitRepo(dir), false);
    await initRepoWithCommit(dir);
    assert.equal(await isGitRepo(dir), true);
  });
});

test("repoRoot and currentBranch report the real values", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    assert.equal(await repoRoot(dir), dir);
    assert.equal(await currentBranch(dir), "main");
  });
});

test("branchExists reflects real branches", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    assert.equal(await branchExists(dir, "main"), true);
    assert.equal(await branchExists(dir, "does-not-exist"), false);
  });
});

test("addWorktree creates a real worktree on a new branch, and listWorktrees finds it", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");

    const worktrees = await listWorktrees(dir);
    assert.equal(worktrees.length, 2);
    const agentWorktree = worktrees.find((w) => w.branch === "aiwork/agent-1");
    assert.ok(agentWorktree);
    assert.equal(agentWorktree?.path, worktreePath);
  });
});

test("removeWorktree removes a clean worktree", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");
    await removeWorktree(dir, worktreePath, false);

    const worktrees = await listWorktrees(dir);
    assert.equal(worktrees.length, 1);
  });
});

test("removeWorktree without --force fails on uncommitted changes, with --force succeeds", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");
    await writeFile(join(worktreePath, "dirty.ts"), "export {}");

    await assert.rejects(() => removeWorktree(dir, worktreePath, false));
    await removeWorktree(dir, worktreePath, true);

    const worktrees = await listWorktrees(dir);
    assert.equal(worktrees.length, 1);
  });
});

test("diffNameOnly reports real committed changes between a branch and its base", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");

    await writeFile(join(worktreePath, "feature.ts"), "export const x = 1;");
    await git(worktreePath, ["add", "feature.ts"]);
    await git(worktreePath, ["commit", "-q", "-m", "add feature"]);

    const changed = await diffNameOnly(worktreePath, "main", "aiwork/agent-1");
    assert.deepEqual(changed, ["feature.ts"]);
  });
});

test("statusPorcelain reports real uncommitted changes", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");
    await writeFile(join(worktreePath, "scratch.ts"), "export {}");

    const files = await statusPorcelain(worktreePath);
    assert.deepEqual(files, ["scratch.ts"]);
  });
});

test("aheadBehind counts real commits made on the agent branch", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");

    await writeFile(join(worktreePath, "a.ts"), "a");
    await git(worktreePath, ["add", "a.ts"]);
    await git(worktreePath, ["commit", "-q", "-m", "commit one"]);
    await writeFile(join(worktreePath, "b.ts"), "b");
    await git(worktreePath, ["add", "b.ts"]);
    await git(worktreePath, ["commit", "-q", "-m", "commit two"]);

    const counts = await aheadBehind(worktreePath, "main", "aiwork/agent-1");
    assert.equal(counts.ahead, 2);
    assert.equal(counts.behind, 0);
  });
});

test("mergeBranch actually merges the agent branch's real commits into the base", async () => {
  await withTempDir(async (dir) => {
    await initRepoWithCommit(dir);
    const worktreePath = join(dir, "agent-1");
    await addWorktree(dir, worktreePath, "aiwork/agent-1", "main");

    await writeFile(join(worktreePath, "feature.ts"), "export const x = 1;");
    await git(worktreePath, ["add", "feature.ts"]);
    await git(worktreePath, ["commit", "-q", "-m", "add feature"]);

    await mergeBranch(dir, "aiwork/agent-1");

    const { readFile } = await import("node:fs/promises");
    const content = await readFile(join(dir, "feature.ts"), "utf8");
    assert.equal(content, "export const x = 1;");
  });
});
