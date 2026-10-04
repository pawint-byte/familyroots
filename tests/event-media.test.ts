import assert from "node:assert/strict";
import test from "node:test";
import { eventMediaUsage, validateEventMedia } from "../server/lib/event-media";

const base = {
  url: "/objects/uploads/00000000-0000-4000-8000-000000000001",
  uploadedAt: "2026-10-04T12:00:00.000Z",
};

test("events without attachments retain the existing save behavior", async () => {
  assert.deepEqual(await validateEventMedia(undefined), []);
  assert.deepEqual(await validateEventMedia(null), []);
});

test("photos and videos are validated using stored metadata and count per file", async () => {
  const attachments = [
    { ...base, type: "image", caption: "A photo" },
    { ...base, url: "/objects/uploads/00000000-0000-4000-8000-000000000002", type: "video" },
  ];
  const validated = await validateEventMedia(attachments, async (url) =>
    url.endsWith("2")
      ? { size: 100 * 1024 * 1024, contentType: "video/mp4" }
      : { size: 10 * 1024 * 1024, contentType: "image/jpeg" },
  );
  assert.deepEqual(validated, attachments);
  assert.deepEqual(eventMediaUsage(validated), { media_upload: 1, voice_video_upload: 1 });
});

test("rejects external URLs and malformed types or timestamps", async () => {
  for (const invalid of [
    { ...base, type: "image", url: "https://example.com/photo.jpg" },
    { ...base, type: "audio" },
    { ...base, type: "image", uploadedAt: "not-a-date" },
  ]) {
    await assert.rejects(validateEventMedia([invalid]), /Invalid/);
  }
});

test("rejects oversized, empty, missing, or incorrectly typed stored objects", async () => {
  const image = [{ ...base, type: "image" }];
  for (const metadata of [
    { size: 10 * 1024 * 1024 + 1, contentType: "image/jpeg" },
    { size: 0, contentType: "image/jpeg" },
    { size: 100, contentType: "video/mp4" },
  ]) {
    await assert.rejects(validateEventMedia(image, async () => metadata));
  }
  await assert.rejects(validateEventMedia(image, async () => { throw new Error("Not found"); }), /missing/);
  await assert.rejects(
    validateEventMedia([{ ...base, type: "video" }], async () => ({ size: 100 * 1024 * 1024 + 1, contentType: "video/mp4" })),
    /100MB/,
  );
});