import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serveStatic } from "../server/static";

test("serves fresh SPA HTML, immutable hashes, and 404s stale assets", async (t) => {
  const distPath = await mkdtemp(path.join(os.tmpdir(), "familyroots-static-"));
  await mkdir(path.join(distPath, "assets"));
  await writeFile(path.join(distPath, "index.html"), "<!doctype html><p>current-release</p>");
  await writeFile(path.join(distPath, "sw.js"), "const CACHE_NAME='familyroots-v2-network-only';");
  await writeFile(path.join(distPath, "assets", "index-abcdefgh.js"), "export {};");

  const app = express();
  serveStatic(app, distPath);
  const server = app.listen(0, "127.0.0.1");
  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    await rm(distPath, { recursive: true, force: true });
  });

  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const route of ["/pricing", "/blog", "/dashboard"]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /current-release/);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  }

  const index = await fetch(`${baseUrl}/`);
  assert.match(index.headers.get("cache-control") || "", /no-store/);

  const worker = await fetch(`${baseUrl}/sw.js`);
  assert.match(worker.headers.get("cache-control") || "", /no-store/);

  const hashedAsset = await fetch(`${baseUrl}/assets/index-abcdefgh.js`);
  assert.equal(hashedAsset.status, 200);
  assert.equal(hashedAsset.headers.get("cache-control"), "public, max-age=31536000, immutable");

  const staleAsset = await fetch(`${baseUrl}/assets/index-oldhash.js`);
  assert.equal(staleAsset.status, 404);
  assert.doesNotMatch(staleAsset.headers.get("content-type") || "", /text\/html/);
  assert.doesNotMatch(await staleAsset.text(), /current-release/);
});