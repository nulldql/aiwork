import { join } from "path";
import {
  listWorktrees,
  addWorktree,
  removeWorktree,
  repoRoot as gitRepoRoot,
  currentBranch,
  branchExists,
  mergeBranch,
} from "./git.js";
import { readState, writeState, withStateLock } from "./state.js";
import type { Agent } from "./types.js";

const BRANCH_PREFIX = "aiwork/";
const WORKTREE_DIR = ".aiwork-worktrees";
const STATE_FILE_NAME = ".aiwork-state.json";

export function branchNameFor(agentName: string): string {
  return `${BRANCH_PREFIX}${agentName}`;
}

export function agentNameFromBranch(branch: string): string | null {
  return branch.startsWith(BRANCH_PREFIX) ? branch.slice(BRANCH_PREFIX.length) : null;
}

export function worktreePathFor(root: string, agentName: string): string {
  return join(root, WORKTREE_DIR, agentName);
}

function statePathFor(root: string): string {
  return join(root, WORKTREE_DIR, STATE_FILE_NAME);
}

export async function repoRoot(cwd: string): Promise<string> {
  return gitRepoRoot(cwd);
}

export async function listAgents(cwd: string): Promise<Agent[]> {
  const root = await gitRepoRoot(cwd);
  const worktrees = await listWorktrees(root);
  const state = await readState(statePathFor(root));
  const agents: Agent[] = [];

  for (const worktree of worktrees) {
    if (!worktree.branch) continue;
    const name = agentNameFromBranch(worktree.branch);
    if (!name) continue;
    agents.push({ name, path: worktree.path, branch: worktree.branch, base: state[name]?.base ?? "main" });
  }

  return agents;
}

export async function getTasks(cwd: string): Promise<Map<string, string | undefined>> {
  const root = await gitRepoRoot(cwd);
  const state = await readState(statePathFor(root));
  const tasks = new Map<string, string | undefined>();
  for (const [name, entry] of Object.entries(state)) tasks.set(name, entry.task);
  return tasks;
}

export async function startAgent(cwd: string, name: string, base?: string, task?: string): Promise<Agent> {
  const root = await gitRepoRoot(cwd);
  const existing = (await listAgents(root)).find((agent) => agent.name === name);
  if (existing) {
    throw new Error(`agent "${name}" already has a worktree at ${existing.path}`);
  }

  const resolvedBase = base ?? (await currentBranch(root));
  if (!(await branchExists(root, resolvedBase))) {
    throw new Error(`base branch "${resolvedBase}" doesn't exist`);
  }

  const branch = branchNameFor(name);
  const worktreePath = worktreePathFor(root, name);
  await addWorktree(root, worktreePath, branch, resolvedBase);

  await withStateLock(statePathFor(root), async () => {
    const state = await readState(statePathFor(root));
    state[name] = { base: resolvedBase, task };
    await writeState(statePathFor(root), state);
  });

  return { name, path: worktreePath, branch, base: resolvedBase };
}

export async function stopAgent(cwd: string, name: string, force: boolean): Promise<void> {
  const root = await gitRepoRoot(cwd);
  const agent = (await listAgents(root)).find((entry) => entry.name === name);
  if (!agent) throw new Error(`no agent named "${name}"`);

  await removeWorktree(root, agent.path, force);

  await withStateLock(statePathFor(root), async () => {
    const state = await readState(statePathFor(root));
    delete state[name];
    await writeState(statePathFor(root), state);
  });
}

export async function mergeAgent(cwd: string, name: string): Promise<string> {
  const root = await gitRepoRoot(cwd);
  const agent = (await listAgents(root)).find((entry) => entry.name === name);
  if (!agent) throw new Error(`no agent named "${name}"`);
  return mergeBranch(root, agent.branch);
}
