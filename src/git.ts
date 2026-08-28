import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 1024 * 1024 * 16 });
  return stdout;
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function repoRoot(cwd: string): Promise<string> {
  const output = await runGit(["rev-parse", "--show-toplevel"], cwd);
  return output.trim();
}

export async function currentBranch(cwd: string): Promise<string> {
  const output = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return output.trim();
}

export type RawWorktree = {
  path: string;
  branch: string | null;
  detached: boolean;
};

export async function listWorktrees(cwd: string): Promise<RawWorktree[]> {
  const output = await runGit(["worktree", "list", "--porcelain"], cwd);
  const worktrees: RawWorktree[] = [];
  let current: Partial<RawWorktree> | null = null;

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current?.path) worktrees.push({ path: current.path, branch: current.branch ?? null, detached: Boolean(current.detached) });
      current = { path: line.slice("worktree ".length).trim(), branch: null, detached: false };
    } else if (line.startsWith("branch ")) {
      if (current) current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
    } else if (line.startsWith("detached")) {
      if (current) current.detached = true;
    }
  }
  if (current?.path) worktrees.push({ path: current.path, branch: current.branch ?? null, detached: Boolean(current.detached) });

  return worktrees;
}

export async function addWorktree(root: string, worktreePath: string, branch: string, base: string): Promise<void> {
  await runGit(["worktree", "add", "-b", branch, worktreePath, base], root);
}

export async function removeWorktree(root: string, worktreePath: string, force: boolean): Promise<void> {
  const args = ["worktree", "remove", worktreePath];
  if (force) args.push("--force");
  await runGit(args, root);
}

export async function deleteBranch(root: string, branch: string, force: boolean): Promise<void> {
  await runGit(["branch", force ? "-D" : "-d", branch], root);
}

export async function diffNameOnly(worktreePath: string, base: string, branch: string): Promise<string[]> {
  try {
    const output = await runGit(["diff", "--name-only", `${base}...${branch}`], worktreePath);
    return output.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function statusPorcelain(worktreePath: string): Promise<string[]> {
  const output = await runGit(["status", "--porcelain", "--untracked-files=all"], worktreePath);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\S+\s+/, "").replace(/^"|"$/g, ""));
}

export async function aheadBehind(worktreePath: string, base: string, branch: string): Promise<{ ahead: number; behind: number }> {
  try {
    const output = await runGit(["rev-list", "--left-right", "--count", `${base}...${branch}`], worktreePath);
    const [behind, ahead] = output.trim().split(/\s+/).map(Number);
    return { ahead: ahead ?? 0, behind: behind ?? 0 };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

export async function mergeBranch(root: string, branch: string): Promise<string> {
  return runGit(["merge", branch], root);
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", branch], cwd);
    return true;
  } catch {
    return false;
  }
}
