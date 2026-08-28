import { mkdtemp, rm, writeFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const rawDir = await mkdtemp(join(tmpdir(), "aiwork-test-"));
  const dir = await realpath(rawDir);
  try {
    return await fn(dir);
  } finally {
    await rm(rawDir, { recursive: true, force: true });
  }
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

export async function initRepoWithCommit(dir: string): Promise<void> {
  await git(dir, ["init", "-q", "-b", "main"]);
  await git(dir, ["config", "user.email", "test@example.com"]);
  await git(dir, ["config", "user.name", "test"]);
  await writeFile(join(dir, "README.md"), "hello");
  await git(dir, ["add", "README.md"]);
  await git(dir, ["commit", "-q", "-m", "initial commit"]);
}

export { git };
