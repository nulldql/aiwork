import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../config.js";

test("parseArgs returns null with no arguments", () => {
  assert.equal(parseArgs([]), null);
});

test("parseArgs returns null on --help", () => {
  assert.equal(parseArgs(["--help"]), null);
});

test("parseArgs parses a full start command", () => {
  const command = parseArgs(["start", "agent-1", "--base", "develop", "--task", "authentication"]);
  if (command?.command !== "start") throw new Error("expected start command");
  assert.equal(command.name, "agent-1");
  assert.equal(command.base, "develop");
  assert.equal(command.task, "authentication");
});

test("parseArgs defaults base and task when not given", () => {
  const command = parseArgs(["start", "agent-1"]);
  if (command?.command !== "start") throw new Error("expected start command");
  assert.equal(command.base, undefined);
  assert.equal(command.task, undefined);
});

test("parseArgs requires a name for start", () => {
  assert.throws(() => parseArgs(["start"]), /needs an agent name/);
});

test("parseArgs parses list and status with --json", () => {
  const list = parseArgs(["list", "--json"]);
  if (list?.command !== "list") throw new Error("expected list command");
  assert.equal(list.json, true);

  const status = parseArgs(["status"]);
  if (status?.command !== "status") throw new Error("expected status command");
  assert.equal(status.json, false);
});

test("parseArgs parses stop with --force", () => {
  const command = parseArgs(["stop", "agent-1", "--force"]);
  if (command?.command !== "stop") throw new Error("expected stop command");
  assert.equal(command.name, "agent-1");
  assert.equal(command.force, true);
});

test("parseArgs requires a name for stop", () => {
  assert.throws(() => parseArgs(["stop"]), /needs an agent name/);
});

test("parseArgs parses merge", () => {
  const command = parseArgs(["merge", "agent-1"]);
  if (command?.command !== "merge") throw new Error("expected merge command");
  assert.equal(command.name, "agent-1");
});

test("parseArgs requires a name for merge", () => {
  assert.throws(() => parseArgs(["merge"]), /needs an agent name/);
});

test("parseArgs rejects an unknown command", () => {
  assert.throws(() => parseArgs(["bogus"]), /unknown command/);
});

test("parseArgs rejects an unknown flag on start", () => {
  assert.throws(() => parseArgs(["start", "agent-1", "--bogus"]), /unknown flag/);
});
