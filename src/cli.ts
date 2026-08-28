#!/usr/bin/env node
import { parseArgs } from "./config.js";
import { isGitRepo } from "./git.js";
import { startAgent, stopAgent, mergeAgent, listAgents, getTasks } from "./agents.js";
import { buildStatuses, overlapsFromStatuses } from "./status.js";
import { formatStatusReport, toJson } from "./report.js";

async function requireGitRepo(): Promise<void> {
  if (!(await isGitRepo("."))) {
    throw new Error("this isn't a git repository");
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let command: ReturnType<typeof parseArgs>;
  try {
    command = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  if (!command) return;

  await requireGitRepo();

  if (command.command === "start") {
    const agent = await startAgent(".", command.name, command.base, command.task);
    console.log(`started ${agent.name} on ${agent.branch}, based on ${agent.base}`);
    console.log(agent.path);
    return;
  }

  if (command.command === "list") {
    const agents = await listAgents(".");
    if (command.json) {
      console.log(JSON.stringify(agents, null, 2));
      return;
    }
    if (agents.length === 0) {
      console.log("no active agents");
      return;
    }
    for (const agent of agents) {
      console.log(`${agent.name}  ${agent.branch}  ${agent.path}`);
    }
    return;
  }

  if (command.command === "status") {
    const statuses = await buildStatuses(".");
    const overlaps = overlapsFromStatuses(statuses);
    const tasks = await getTasks(".");

    if (command.json) {
      console.log(JSON.stringify(toJson(statuses, overlaps, tasks), null, 2));
      return;
    }
    if (statuses.length === 0) {
      console.log("no active agents");
      return;
    }
    console.log(formatStatusReport(statuses, overlaps, tasks));
    return;
  }

  if (command.command === "stop") {
    try {
      await stopAgent(".", command.name, command.force);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("contains modified or untracked files")) {
        throw new Error(`"${command.name}" has uncommitted changes, pass --force to remove it anyway`);
      }
      throw err;
    }
    console.log(`stopped ${command.name}`);
    return;
  }

  if (command.command === "merge") {
    const output = await mergeAgent(".", command.name);
    console.log(output.trim() || `merged ${command.name}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
