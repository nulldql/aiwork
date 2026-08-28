export type Command =
  | { command: "start"; name: string; base?: string; task?: string }
  | { command: "list"; json: boolean }
  | { command: "status"; json: boolean }
  | { command: "stop"; name: string; force: boolean }
  | { command: "merge"; name: string };

function printHelp(): void {
  console.log(`aiwork <start|list|status|stop|merge> ...

gives each ai coding agent its own git worktree, on its own branch, and
flags it before two agents collide on the same files.

  start <name>          create an isolated worktree and branch for an agent
  list                    list every active agent worktree
  status                   show what each agent has touched and flag overlaps
  stop <name>              remove an agent's worktree
  merge <name>             merge an agent's branch into the branch you started it from

  --base <branch>          start only, branch to base the new worktree on (default: current branch)
  --task "<description>"   start only, a short description shown by status
  --force                  stop only, remove the worktree even with uncommitted changes
  --json                   list and status only, print machine-readable JSON

examples:
  aiwork start agent-1 --task "authentication"
  aiwork start agent-2 --task "user profiles"
  aiwork status
  aiwork stop agent-1
`);
}

export function parseArgs(argv: string[]): Command | null {
  if (argv.length === 0 || argv.includes("--help")) {
    printHelp();
    return null;
  }

  const [command, ...rest] = argv;

  function next(flag: string, i: number): string {
    const value = rest[i + 1];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    return value;
  }

  if (command === "start") {
    const positional: string[] = [];
    let base: string | undefined;
    let task: string | undefined;

    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === "--base") {
        base = next(arg, i);
        i += 1;
      } else if (arg === "--task") {
        task = next(arg, i);
        i += 1;
      } else if (arg.startsWith("--")) {
        throw new Error(`unknown flag "${arg}"`);
      } else {
        positional.push(arg);
      }
    }

    const name = positional[0];
    if (!name) throw new Error("start needs an agent name");
    return { command: "start", name, base, task };
  }

  if (command === "list") {
    return { command: "list", json: rest.includes("--json") };
  }

  if (command === "status") {
    return { command: "status", json: rest.includes("--json") };
  }

  if (command === "stop") {
    const name = rest.find((arg) => !arg.startsWith("--"));
    if (!name) throw new Error("stop needs an agent name");
    return { command: "stop", name, force: rest.includes("--force") };
  }

  if (command === "merge") {
    const name = rest.find((arg) => !arg.startsWith("--"));
    if (!name) throw new Error("merge needs an agent name");
    return { command: "merge", name };
  }

  throw new Error(`unknown command "${command}", use "start", "list", "status", "stop", or "merge"`);
}
