# aiwork

Gives every AI coding agent its own real git worktree, on its own branch, and tells you before two agents step on the same file instead of after.

```bash
aiwork start agent-1 --task "authentication"
aiwork start agent-2 --task "user profiles"
aiwork status
```

```
AGENT 1 (agent-1)
Working on authentication
branch: aiwork/agent-1  ahead 0 / behind 0  (uncommitted changes)

AGENT 2 (agent-2)
Working on user profiles
branch: aiwork/agent-2  ahead 0 / behind 0  (uncommitted changes)

OVERLAP

Both agent-1 and agent-2 are modifying:
  src/user/UserService.ts

Potential conflict: HIGH
```

## Why this exists

Point two coding agents at the same repo and they'll happily edit the same file at the same time, with neither one aware the other exists. `git worktree` already solves the isolation half of that, each agent gets its own working directory and branch, checked out from the same repo, no cloning. What it doesn't do is tell you when two of those isolated worktrees are quietly heading for a merge conflict. This adds that part: real file-level and directory-level overlap detection between whatever agents are currently active, computed from the actual diffs and actual working tree status in each worktree, not from guessing.

## Install

Not published to npm yet, so clone and run it directly:

```bash
git clone https://github.com/nulldql/aiwork.git
cd aiwork
npm install
npm run build
node dist/cli.js start <name>
```

## Commands

```bash
aiwork start agent-1 --task "authentication"
```

Creates a real worktree at `.aiwork-worktrees/agent-1` on a new branch `aiwork/agent-1`, branched from whatever branch you're currently on (override with `--base`). Point your agent's working directory at the path it prints. `--task` is optional, just a short description that shows up in `status` so you don't have to guess what each agent is doing from its diff.

```bash
aiwork list
```

Lists every active agent worktree, name, branch, and path.

```bash
aiwork status
```

For every active agent, shows what it's touched, both committed changes on its branch and anything still uncommitted, whether it's ahead or behind its base branch, and cross-checks every pair of agents against each other. Two agents editing the exact same file is flagged HIGH. Two agents editing different files in the same directory is flagged MEDIUM. Anything else gets no warning at all.

```bash
aiwork stop agent-1
```

Removes the worktree. Refuses if there's uncommitted work in it, pass `--force` to remove it anyway.

```bash
aiwork merge agent-1
```

Merges the agent's branch back into whatever it was based on, run from the main repo, not from inside the agent's worktree.

### Options

```
--base <branch>          start only, branch to base the new worktree on (default: current branch)
--task "<description>"   start only, shown by status
--force                  stop only, remove the worktree even with uncommitted changes
--json                   list and status only, print machine-readable JSON
--help                   show this message
```

## How overlap detection works

Every agent's touched-file set is the union of `git diff --name-only <base>...<branch>` (real committed changes) and `git status --porcelain --untracked-files=all` (real uncommitted changes, including brand new untracked files, listed individually rather than collapsed into their parent directory). Every pair of active agents gets checked against each other: any file both sets contain is a HIGH risk overlap, any directory both sets touch without an exact file match is MEDIUM. There's no guessing involved, if `status` says two agents overlap, it's because their actual working trees do.

## Known limitations

Overlap detection is file-path based, not line based, two agents editing different functions in the same file still get flagged HIGH even if their actual changes wouldn't conflict at merge time. That's a deliberate tradeoff: a false positive costs you a glance at `status`, a missed real conflict costs you a broken merge.

`merge` is a thin wrapper around `git merge`, it doesn't do anything smarter than git already does about resolving conflicts. If the merge doesn't fast-forward or apply cleanly, you're resolving it the normal way.

## Development

```bash
git clone https://github.com/nulldql/aiwork.git
cd aiwork
npm install
npm test
```

`npm test` builds the project and runs the full suite with Node's built-in test runner. Most of it runs against real, disposable git repositories created fresh for each test, real `git init`, real commits, real `git worktree add`, real overlap scenarios built by actually writing conflicting files into two separate worktrees and checking that status catches it, not fixtures standing in for git's behavior.

## License

MIT
