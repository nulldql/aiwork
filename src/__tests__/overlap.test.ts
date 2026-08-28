import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOverlaps } from "../overlap.js";

test("computeOverlaps flags high risk when two agents touch the same file", () => {
  const touched = new Map([
    ["agent-1", ["src/user/UserService.ts", "src/auth/login.ts"]],
    ["agent-2", ["src/user/UserService.ts", "src/profile/edit.ts"]],
  ]);
  const overlaps = computeOverlaps(touched);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].risk, "high");
  assert.deepEqual(overlaps[0].sharedFiles, ["src/user/UserService.ts"]);
});

test("computeOverlaps flags medium risk for shared directories without shared files", () => {
  const touched = new Map([
    ["agent-1", ["src/user/UserService.ts"]],
    ["agent-2", ["src/user/UserRepository.ts"]],
  ]);
  const overlaps = computeOverlaps(touched);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].risk, "medium");
  assert.deepEqual(overlaps[0].sharedDirectories, ["src/user"]);
});

test("computeOverlaps reports nothing when agents touch unrelated areas", () => {
  const touched = new Map([
    ["agent-1", ["src/auth/login.ts"]],
    ["agent-2", ["src/profile/edit.ts"]],
  ]);
  assert.deepEqual(computeOverlaps(touched), []);
});

test("computeOverlaps handles a single agent without crashing", () => {
  const touched = new Map([["agent-1", ["src/a.ts"]]]);
  assert.deepEqual(computeOverlaps(touched), []);
});

test("computeOverlaps handles three agents and finds every pairwise overlap", () => {
  const touched = new Map([
    ["a", ["shared.ts"]],
    ["b", ["shared.ts"]],
    ["c", ["other.ts"]],
  ]);
  const overlaps = computeOverlaps(touched);
  assert.equal(overlaps.length, 1);
  assert.deepEqual([overlaps[0].agentA, overlaps[0].agentB], ["a", "b"]);
});

test("computeOverlaps ignores an empty top-level directory as a false shared directory", () => {
  const touched = new Map([
    ["a", ["root-file.ts"]],
    ["b", ["another-root-file.ts"]],
  ]);
  assert.deepEqual(computeOverlaps(touched), []);
});
