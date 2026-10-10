---
name: Member video recording boundaries
description: User-directed location and upload-flow boundaries for in-browser badge video recording.
---

In-browser badge video recording belongs beside video upload in the tree's member detail panel, not on `/my-badge`.

**Why:** The user explicitly specified this location and prohibited changes to other pages, badge statistics, subscriptions, or the existing upload flow.

**How to apply:** Keep future recorder changes within the member video controls and reuse their edit and subscription gates. Do not add a second recording entry point to `/my-badge` without a new user request.

“Use this video” selects a draft for the existing title and Save flow; it does not automatically upload or create another saving pipeline.

**Why:** Preserving the existing upload flow was an explicit constraint, including the same validation, size limit, and endpoints.

**How to apply:** Pass a recorded File through the same selection validation as uploaded files and retain the existing explicit Save action.
