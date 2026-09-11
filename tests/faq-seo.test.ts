import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { faqCategories, faqAnswerText, FAQ_HEADING, getFaqStructuredData } from "../shared/faq";
import { injectSeoMetadata } from "../server/seoMetadata";
import { serveStatic } from "../server/static";

const template = `<!doctype html><html><head>
<title>Default</title>
<link rel="canonical" href="https://familyroots.family/" />
</head><body><div id="root"></div></body></html>`;

function textContent(html: string): string {
  return html.replace(/<br\s*\/?>|<\/?(?:ul|li|p)\b[^>]*>/g, " ")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ").trim();
}

function assertCompleteFaq(html: string) {
  assert.equal(textContent(html.match(/<h1>([\s\S]*?)<\/h1>/)![1]), FAQ_HEADING);
  const items = faqCategories.flatMap((category) => category.items);
  const renderedItems = [...html.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<div data-faq-answer>([\s\S]*?)<\/div>/g)];
  assert.equal(renderedItems.length, items.length);
  assert.deepEqual(
    renderedItems.map((match) => ({ question: textContent(match[1]), answer: textContent(match[2]) })),
    items.map((item) => ({ question: item.question, answer: faqAnswerText(item.answer) })),
  );
  const jsonScripts = [...html.matchAll(/<script type="application\/ld\+json" data-faq-jsonld>([\s\S]*?)<\/script>/g)];
  assert.equal(jsonScripts.length, 1);
  const schema = JSON.parse(jsonScripts[0][1]);
  assert.deepEqual(schema, getFaqStructuredData());
  assert.equal(schema["@type"], "FAQPage");
  assert.equal(schema.mainEntity.length, items.length);
  assert.deepEqual(
    schema.mainEntity.map((entry: { name: string; acceptedAnswer: { text: string } }) =>
      ({ question: entry.name, answer: entry.acceptedAnswer.text })),
    items.map((item) => ({ question: item.question, answer: faqAnswerText(item.answer) })),
  );
  assert.match(html, /href="https:\/\/familyroots\.family\/faq"/);
}

test("initial FAQ HTML includes every question, answer, links and matching JSON-LD", () => {
  for (const route of ["/faq", "/faq?utm_source=test", "/faq/"]) {
    const html = injectSeoMetadata(template, route);
    assertCompleteFaq(html);
    assert.equal(injectSeoMetadata(html, route), html, "does not duplicate prerender");
    for (const part of faqCategories.flatMap((category) =>
      category.items.flatMap((item) => item.answer))) {
      if (typeof part !== "string" && "href" in part) {
        assert.ok(html.includes(`href="${part.href}"`), `preserves link ${part.href}`);
      }
    }
  }
});

test("injects the full FAQ into the actual client shell's empty React root", async () => {
  const clientIndex = await readFile("client/index.html", "utf-8");
  assert.match(clientIndex, /<div id="root"><\/div>/);

  const html = injectSeoMetadata(clientIndex, "/faq");
  const items = faqCategories.flatMap((category) => category.items);
  const renderedItems = [...html.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<div data-faq-answer>/g)];
  const jsonScripts = [...html.matchAll(/<script type="application\/ld\+json" data-faq-jsonld>([\s\S]*?)<\/script>/g)];

  assert.equal(items.length, 199);
  assert.equal(renderedItems.length, 199);
  assert.equal(jsonScripts.length, 1);
  assert.equal(JSON.parse(jsonScripts[0][1]).mainEntity.length, 199);
  assertCompleteFaq(html);
  assert.match(html, /<div id="root"><main data-faq-prerender>/);
});

test("does not add FAQ content or schema to other pages", () => {
  for (const route of ["/", "/pricing", "/features", "/unknown", "/faq-other"]) {
    const html = injectSeoMetadata(template, route);
    assert.doesNotMatch(html, /data-faq-prerender|data-faq-jsonld|FAQPage/);
  }
});

test("escapes HTML, script terminators and replacement-string metacharacters", () => {
  const item = {
    question: 'Safety <img src=x onerror=alert(1)> & "$&"',
    answer: ['Literal </script><script>alert(1)</script> & $&'],
  };
  faqCategories[0].items.push(item);
  try {
    const html = injectSeoMetadata(template, "/faq");
    assertCompleteFaq(html);
    assert.doesNotMatch(html, /<img src=x|<script>alert/);
    assert.match(html, /\\u003c\/script\\u003e/);
  } finally {
    faqCategories[0].items.pop();
  }
});

test("Express serves crawlable /faq, redirects case variants, and keeps sitemap unchanged", async (t) => {
  const distPath = await mkdtemp(path.join(os.tmpdir(), "familyroots-faq-"));
  await writeFile(path.join(distPath, "index.html"), template);
  const sitemap = await readFile("client/public/sitemap.xml", "utf-8");
  await writeFile(path.join(distPath, "sitemap.xml"), sitemap);
  const app = express();
  serveStatic(app, distPath);
  const server = app.listen(0, "127.0.0.1");
  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    await rm(distPath, { recursive: true, force: true });
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/faq`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assertCompleteFaq(await response.text());

  for (const variant of ["/FAQ", "/Faq", "/fAQ", "/FAQ/"]) {
    for (const method of ["GET", "HEAD"]) {
      const redirect = await fetch(`${baseUrl}${variant}?utm_source=test&x=1`, {
        redirect: "manual", method,
      });
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get("location"), "/faq?utm_source=test&x=1");
    }
  }
  const canonical = await fetch(`${baseUrl}/faq?utm_source=test`, { redirect: "manual" });
  assert.equal(canonical.status, 200, "canonical URL does not loop");
  const other = await fetch(`${baseUrl}/FAQ-other`, { redirect: "manual" });
  assert.equal(other.status, 200, "redirect applies only to FAQ case variants");
  assert.doesNotMatch(await other.text(), /data-faq-prerender/);
  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200);
  assert.equal(await sitemapResponse.text(), sitemap);
  assert.equal((sitemap.match(/<loc>https:\/\/familyroots\.family\/faq<\/loc>/g) || []).length, 1);
});