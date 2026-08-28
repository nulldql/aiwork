import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStatusReport, toJson } from "../report.js";
import type { AgentStatus, Overlap } from "../types.js";

function status(name: string, branch: string, touchedFiles: string[]): AgentStatus {
  return {
    agent: { name, branch, path: `/repo/.aiwork-worktrees/${name}`, base: "main" },
    touchedFiles,
    hasUncommittedChanges: touchedFiles.length > 0,
    ahead: touchedFiles.length,
    behind: 0,
  };
}

test("formatStatusReport shows the task description when one was given", () => {
  const statuses = [status("agent-1", "aiwork/agent-1", ["src/auth/login.ts"])];
  const tasks = new Map([["agent-1", "authentication"]]);
  const output = formatStatusReport(statuses, [], tasks);
  assert.match(output, /AGENT 1 \(agent-1\)/);
  assert.match(output, /Working on authentication/);
});

test("formatStatusReport falls back to listing touched files when there's no task description", () => {
  const statuses = [status("agent-1", "aiwork/agent-1", ["src/auth/login.ts"])];
  const output = formatStatusReport(statuses, [], new Map());
  assert.match(output, /Touching: src\/auth\/login\.ts/);
});

test("formatStatusReport reports no changes yet when nothing's touched", () => {
  const statuses = [status("agent-1", "aiwork/agent-1", [])];
  const output = formatStatusReport(statuses, [], new Map());
  assert.match(output, /No changes yet/);
});

test("formatStatusReport prints an OVERLAP section with shared files and the risk level", () => {
  const statuses = [
    status("agent-1", "aiwork/agent-1", ["src/user/UserService.ts"]),
    status("agent-2", "aiwork/agent-2", ["src/user/UserService.ts"]),
  ];
  const overlap: Overlap = {
    agentA: "agent-1",
    agentB: "agent-2",
    sharedFiles: ["src/user/UserService.ts"],
    sharedDirectories: [],
    risk: "high",
  };
  const output = formatStatusReport(statuses, [overlap], new Map());
  assert.match(output, /OVERLAP/);
  assert.match(output, /src\/user\/UserService\.ts/);
  assert.match(output, /Potential conflict: HIGH/);
});

test("formatStatusReport says there's no overlap when there isn't any", () => {
  const statuses = [status("agent-1", "aiwork/agent-1", ["a.ts"])];
  const output = formatStatusReport(statuses, [], new Map());
  assert.match(output, /No overlap between active agents\./);
});

test("toJson produces a plain serializable shape including overlaps", () => {
  const statuses = [status("agent-1", "aiwork/agent-1", ["a.ts"])];
  const overlap: Overlap = { agentA: "agent-1", agentB: "agent-2", sharedFiles: ["a.ts"], sharedDirectories: [], risk: "high" };
  const json = toJson(statuses, [overlap], new Map([["agent-1", "auth"]])) as { agents: unknown[]; overlaps: unknown[] };
  assert.equal(json.agents.length, 1);
  assert.equal(json.overlaps.length, 1);
});
