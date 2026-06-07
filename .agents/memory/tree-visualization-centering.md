---
name: Family tree visualization auto-centering
description: How/why the family tree viewport centers, and the white-space bug to avoid
---

# Family tree visualization auto-centering

In `client/src/components/family-tree-visualization.tsx`, the viewport auto-centers
on the tree's **bounding box** (min/max of all node x/y), NOT on a single focus member.

**Why:** Centering on the focus member (commonly the youngest person, who has only
ancestors above and no descendants below) clustered the whole tree in the top half of
the screen and left the bottom half empty white space. Users perceived this as a broken
layout where dragging couldn't "fill" the page. Centering the bounding box fills the
viewport evenly.

**How to apply:**
- Keep `centerTree()` measuring the laid-out container and bailing on a 0x0 rect
  (the tree mounts inside a Radix `TabsContent`, which can be 0-sized before layout).
- A `ResizeObserver` re-centers once the container is first measured / resized, but is
  guarded by `userPannedRef` so it never overrides a manual pan.
- `userPannedRef` is reset to false whenever the tree/focus/zoom/depth changes (a fresh
  layout is allowed to auto-center again) and set true on mouse/touch pan start.
- `GroupVisualization` has its own `onAutoFitZoom` auto-fit; `FamilyTreeVisualization`
  only centers (no auto-zoom). Pan has no offset clamping by design (free panning).
