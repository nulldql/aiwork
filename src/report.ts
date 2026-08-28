import type { AgentStatus, Overlap } from "./types.js";

export function formatStatusReport(
  statuses: AgentStatus[],
  overlaps: Overlap[],
  tasks: Map<string, string | undefined>,
): string {
  const lines: string[] = [];

  statuses.forEach((status, index) => {
    lines.push(`AGENT ${index + 1} (${status.agent.name})`);
    const task = tasks.get(status.agent.name);
    if (task) {
      lines.push(`Working on ${task}`);
    } else if (status.touchedFiles.length > 0) {
      const preview = status.touchedFiles.slice(0, 5).join(", ");
      const extra = status.touchedFiles.length > 5 ? `, and ${status.touchedFiles.length - 5} more` : "";
      lines.push(`Touching: ${preview}${extra}`);
    } else {
      lines.push("No changes yet");
    }
    const dirtyNote = status.hasUncommittedChanges ? "  (uncommitted changes)" : "";
    lines.push(`branch: ${status.agent.branch}  ahead ${status.ahead} / behind ${status.behind}${dirtyNote}`);
    lines.push("");
  });

  if (overlaps.length === 0) {
    lines.push("No overlap between active agents.");
    return lines.join("\n").trimEnd();
  }

  for (const overlap of overlaps) {
    lines.push("OVERLAP");
    lines.push("");
    if (overlap.sharedFiles.length > 0) {
      lines.push(`Both ${overlap.agentA} and ${overlap.agentB} are modifying:`);
      for (const file of overlap.sharedFiles) lines.push(`  ${file}`);
    } else {
      lines.push(`${overlap.agentA} and ${overlap.agentB} are both touching the same directories:`);
      for (const dir of overlap.sharedDirectories) lines.push(`  ${dir}/`);
    }
    lines.push("");
    lines.push(`Potential conflict: ${overlap.risk.toUpperCase()}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function toJson(statuses: AgentStatus[], overlaps: Overlap[], tasks: Map<string, string | undefined>): unknown {
  return {
    agents: statuses.map((status) => ({
      name: status.agent.name,
      branch: status.agent.branch,
      base: status.agent.base,
      path: status.agent.path,
      task: tasks.get(status.agent.name),
      touchedFiles: status.touchedFiles,
      hasUncommittedChanges: status.hasUncommittedChanges,
      ahead: status.ahead,
      behind: status.behind,
    })),
    overlaps,
  };
}
