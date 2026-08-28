import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

export type AgentState = Record<string, { base: string; task?: string }>;

export async function readState(statePath: string): Promise<AgentState> {
  try {
    const raw = await readFile(statePath, "utf8");
    return JSON.parse(raw) as AgentState;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return {};
    throw err;
  }
}

export async function writeState(statePath: string, state: AgentState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
