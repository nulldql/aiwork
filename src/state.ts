import { readFile, writeFile, mkdir, open, unlink, stat, rename } from "fs/promises";
import { dirname, join } from "path";
import { randomBytes } from "crypto";

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
  const dir = dirname(statePath);
  await mkdir(dir, { recursive: true });
  const tmpPath = join(dir, `.aiwork-state.${randomBytes(6).toString("hex")}.tmp`);
  await writeFile(tmpPath, JSON.stringify(state, null, 2));
  await rename(tmpPath, statePath);
}

const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_ATTEMPTS = 100;

async function acquireLock(lockPath: string): Promise<void> {
  await mkdir(dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt++) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      return;
    } catch (err) {
      if (!err || typeof err !== "object" || (err as { code?: string }).code !== "EEXIST") throw err;

      try {
        const stats = await stat(lockPath);
        if (Date.now() - stats.mtimeMs > LOCK_STALE_MS) {
          await unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
    }
  }

  throw new Error(`couldn't acquire the state lock at ${lockPath}, another aiwork command may be stuck`);
}

async function releaseLock(lockPath: string): Promise<void> {
  await unlink(lockPath).catch(() => {});
}

export async function withStateLock<T>(statePath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${statePath}.lock`;
  await acquireLock(lockPath);
  try {
    return await fn();
  } finally {
    await releaseLock(lockPath);
  }
}
