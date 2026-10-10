import assert from "node:assert/strict";
import test from "node:test";
import { calculateTreeFit } from "../client/src/lib/tree-fit";

test("fits every edge of a large All-depth tree in desktop and phone viewports", () => {
  const bounds = { left: -120, top: 80, right: 3910, bottom: 1940 };
  for (const [width, height] of [[1280, 700], [390, 600], [700, 390]]) {
    const fit = calculateTreeFit(width, height, bounds)!;
    assert.ok(fit.zoom > 0 && fit.zoom <= 1);
    assert.ok(bounds.left * fit.zoom + fit.offset.x >= 16 - 1e-8);
    assert.ok(bounds.top * fit.zoom + fit.offset.y >= 16 - 1e-8);
    assert.ok(bounds.right * fit.zoom + fit.offset.x <= width - 16 + 1e-8);
    assert.ok(bounds.bottom * fit.zoom + fit.offset.y <= height - 16 + 1e-8);
    assert.ok(Math.abs((bounds.left + bounds.right) / 2 * fit.zoom + fit.offset.x - width / 2) < 1e-8);
    assert.ok(Math.abs((bounds.top + bounds.bottom) / 2 * fit.zoom + fit.offset.y - height / 2) < 1e-8);
  }
});

test("does not enlarge small trees and includes actual uneven card heights", () => {
  const fit = calculateTreeFit(1000, 600, { left: 100, top: 50, right: 400, bottom: 280 })!;
  assert.equal(fit.zoom, 1);
  assert.deepEqual(fit.offset, { x: 250, y: 135 });
});

test("ignores hidden or empty layouts and permits fitting below the old zoom floor", () => {
  assert.equal(calculateTreeFit(0, 600, { left: 0, top: 0, right: 100, bottom: 100 }), null);
  assert.equal(calculateTreeFit(500, 600, { left: 0, top: 0, right: 0, bottom: 100 }), null);
  assert.ok(calculateTreeFit(390, 600, { left: 0, top: 0, right: 4030, bottom: 1860 })!.zoom < 0.4);
});
