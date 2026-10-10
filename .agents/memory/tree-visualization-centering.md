---
name: Family tree visualization auto-centering
description: How/why the family tree viewport centers, and the white-space bug to avoid
---

# Family tree visualization auto-centering

Center and fit on the whole rendered tree's **bounding box**, not on a single
focus member or the fixed-size drawing canvas.

**Why:** Centering on the focus member (commonly the youngest person, who has only
ancestors above and no descendants below) clustered the whole tree in the top half of
the screen and left the bottom half empty white space. Users perceived this as a broken
layout where dragging couldn't "fill" the page. Centering the bounding box fills the
viewport evenly.

**How to apply:** Preserve bounding-box centering when changing focus, depth, or
viewport behavior. Measurements must wait for a nonzero viewport because tabs can
initially mount without dimensions.

Auto-fit must measure a viewport constrained to the visible page, rather than
allowing the canvas's intrinsic width to expand a flex container.

**Why:** In a real large-tree preview, the apparent viewport expanded beyond the
browser width; cards were technically inside that rectangle but still offscreen.

**How to apply:** Validate both the card bounds against the viewport and the
viewport against the browser bounds. Keep the oversized drawing canvas separate
from viewport sizing.

Do not make automatic fitting depend on the current manual zoom or pan.

**Why:** Manual interactions must remain usable after fitting rather than snapping
back. Resize and actual data/depth changes intentionally request a new fit.

**How to apply:** Verify manual zoom and pan persist between explicit fit events.
