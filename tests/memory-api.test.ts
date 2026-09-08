import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createMemory, deleteMemory, memoryErrorToast, type MemoryDraft } from "../client/src/lib/memory-api";
import { insertMemorySchema } from "../shared/schema";

const draft: MemoryDraft = {
  title: "  QA Synthetic Story  ",
  story: "  A fictional demo robot grew a paper tree.  ",
  eventDate: "",
  category: "memory",
  memberId: "",
  photoUrl: "",
};

test("memory save sends a credentialed JSON POST matching the server insert schema", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    calls++;
    assert.equal(url, "/api/trees/qa-tree/memories");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    const payload = JSON.parse(options.body as string);
    assert.deepEqual(payload, {
      title: "QA Synthetic Story",
      story: "A fictional demo robot grew a paper tree.",
      eventDate: null, category: "memory", memberId: null, photoUrl: null,
    });
    assert.equal(insertMemorySchema.safeParse({
      ...payload, treeId: "qa-tree", createdByUserId: "qa-user",
    }).success, true);
    assert.equal("createdByUserId" in payload, false);
    return new Response(JSON.stringify({ id: "qa-memory" }), { status: 201 });
  });
  assert.equal((await createMemory("qa-tree", draft)).status, 201);
  assert.equal(calls, 1);
});

test("explicit No specific member and blank optional story serialize as null", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const payload = JSON.parse(options.body as string);
    assert.equal(payload.memberId, null);
    assert.equal(payload.story, null);
    return new Response("{}", { status: 201 });
  });
  await createMemory("qa-tree", { ...draft, memberId: "none", story: "  " });
});

test("member, date, category and uploaded photo path are preserved", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const payload = JSON.parse(options.body as string);
    assert.equal(payload.memberId, "qa-member");
    assert.equal(payload.eventDate, "2026-09-08");
    assert.equal(payload.category, "tradition");
    assert.equal(payload.photoUrl, "/objects/uploads/qa-photo");
    return new Response("{}", { status: 201 });
  });
  await createMemory("qa-tree", {
    ...draft, memberId: "qa-member", eventDate: "2026-09-08",
    category: "tradition", photoUrl: "/objects/uploads/qa-photo",
  });
});

test("memory delete uses the correct method, URL and native session", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/memories/qa-memory");
    assert.equal(options.method, "DELETE");
    assert.equal(options.credentials, "include");
    assert.equal(options.body, undefined);
    return new Response(null, { status: 204 });
  });
  assert.equal((await deleteMemory("qa-memory")).status, 204);
});

for (const [status, body, title] of [
  [400, { message: "Invalid memory data" }, "Error"],
  [403, { message: "Access denied" }, "Error"],
  [403, { error: "tier_limit_reached", message: "Monthly upload limit reached." }, "Upload limit reached"],
  [500, { message: "Failed to create memory" }, "Error"],
] as const) {
  test(`server ${status} ${body.message} stays an error with a useful toast`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status }));
    await assert.rejects(createMemory("qa-tree", draft), (error: unknown) => {
      assert.deepEqual(memoryErrorToast(error, "fallback"), { title, description: body.message });
      return true;
    });
  });
}

test("network and non-JSON errors use a safe fallback instead of exposing raw responses", () => {
  for (const error of [new TypeError("Failed to fetch"), new Error("502: <html>proxy error</html>"), null]) {
    assert.deepEqual(memoryErrorToast(error, "Please try again."), {
      title: "Error", description: "Please try again.",
    });
  }
});

test("Memory Lane routes only call methods declared by the storage interface", () => {
  const source = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("storage.ts", source, ts.ScriptTarget.Latest, true);
  const storageInterface = ast.statements.find((node): node is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(node) && node.name.text === "IStorage");
  assert.ok(storageInterface, "storage interface exists");
  const methods = new Set(storageInterface.members.map(member => member.name?.getText(ast)));
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const start = routes.indexOf("// ==================== MEMORY LANE ROUTES");
  const end = routes.indexOf("// ==================== ANNUAL TREE REPORT", start);
  assert.ok(start >= 0 && end > start, "Memory Lane route section exists");
  const calls = [...routes.slice(start, end).matchAll(/\bstorage\.(\w+)\(/g)];
  assert.ok(calls.length > 0, "Memory Lane uses storage");
  for (const [, method] of calls) {
    assert.ok(methods.has(method), `Memory Lane calls an undeclared storage method: ${method}`);
  }
});