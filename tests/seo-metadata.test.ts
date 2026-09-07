import assert from "node:assert/strict";
import test from "node:test";
import {
  injectSeoMetadata,
  PUBLIC_SEO_METADATA,
} from "../server/seoMetadata";

const expectedPaths = [
  "/",
  "/pricing",
  "/features",
  "/about",
  "/blog",
  "/faq",
  "/privacy",
  "/terms",
  "/comparison",
  "/whats-new",
  "/gifts",
  "/merchandise",
  "/share",
  "/records",
];

test("defines unique complete metadata for every requested public route", () => {
  assert.deepEqual(Object.keys(PUBLIC_SEO_METADATA).sort(), expectedPaths.sort());
  assert.equal(new Set(Object.values(PUBLIC_SEO_METADATA).map((seo) => seo.title)).size, expectedPaths.length);
  assert.equal(new Set(Object.values(PUBLIC_SEO_METADATA).map((seo) => seo.description)).size, expectedPaths.length);

  for (const path of expectedPaths) {
    const seo = PUBLIC_SEO_METADATA[path];
    assert.ok(seo.title);
    assert.ok(seo.description);
    assert.equal(seo.canonical, `https://familyroots.family${path}`);
  }
});

test("injects title, description, canonical, and Open Graph metadata by path", () => {
  const template = `
    <title>Default</title>
    <meta name="description" content="Default" />
    <link rel="canonical" href="https://familyroots.family/" />
    <meta property="og:title" content="Default" />
    <meta property="og:description" content="Default" />
    <meta property="og:url" content="https://familyroots.family/" />
    <meta name="twitter:title" content="Default" />
    <meta name="twitter:description" content="Default" />
  `;

  const result = injectSeoMetadata(template, "/pricing?source=test");
  const seo = PUBLIC_SEO_METADATA["/pricing"];
  assert.match(result, /<title>Pricing - FamilyRoots \| Plans &amp; Member Packs<\/title>/);
  assert.match(result, new RegExp(`content="${seo.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(result, /<link rel="canonical" href="https:\/\/familyroots\.family\/pricing" \/>/);
  assert.match(result, /<meta property="og:url" content="https:\/\/familyroots\.family\/pricing" \/>/);
});