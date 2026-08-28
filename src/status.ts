import { listAgents } from "./agents.js";
import { diffNameOnly, statusPorcelain, aheadBehind } from "./git.js";
import { computeOverlaps } from "./overlap.js";
import type { AgentStatus, Overlap } from "./types.js";

export async function buildStatuses(cwd: string): Promise<AgentStatus[]> {
  const agents = await listAgents(cwd);
  const statuses: AgentStatus[] = [];

  for (const agent of agents) {
    const [committed, uncommitted, counts] = await Promise.all([
      diffNameOnly(agent.path, agent.base, agent.branch),
      statusPorcelain(agent.path),
      aheadBehind(agent.path, agent.base, agent.branch),
    ]);

    const touchedFiles = [...new Set([...committed, ...uncommitted])].sort();

    statuses.push({
      agent,
      touchedFiles,
      hasUncommittedChanges: uncommitted.length > 0,
      ahead: counts.ahead,
      behind: counts.behind,
    });
  }

  return statuses;
}

export function overlapsFromStatuses(statuses: AgentStatus[]): Overlap[] {
  const touchedByAgent = new Map(statuses.map((status) => [status.agent.name, status.touchedFiles]));
  return computeOverlaps(touchedByAgent);
}
