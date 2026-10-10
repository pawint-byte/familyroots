import assert from "node:assert/strict";
import test from "node:test";
import { uniqueTrees } from "../server/lib/unique-trees";

test("repeated access rows produce only one tree listing", () => {
  const tree = { id: "shared-tree", name: "Family tree" };
  assert.deepEqual(uniqueTrees([tree, { ...tree }]), [tree]);
});

test("same-named trees with different identifiers remain separate", () => {
  const trees = [{ id: "a", name: "Family tree" }, { id: "b", name: "Family tree" }];
  assert.deepEqual(uniqueTrees(trees), trees);
});

test("preserves the first owned-tree record and never mutates source data", () => {
  const trees = [{ id: "a", source: "owned" }, { id: "a", source: "shared" }, { id: "b", source: "shared" }];
  const before = JSON.stringify(trees);
  assert.deepEqual(uniqueTrees(trees), [trees[0], trees[2]]);
  assert.equal(JSON.stringify(trees), before);
});
