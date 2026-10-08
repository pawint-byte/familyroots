---
name: GA4 conversion verification
description: What counts as a real signup conversion and how to verify delivery.
---

Count a signup conversion only after a new account is persisted, with its actual registration method. A returning login, form submission, or recovery of an existing account is not a new signup. Never attach email, names, tokens, or other personal details to the event.

**Why:** Paid-ad decisions depend on signup completions, not form starts. In preview testing, an event appeared in the browser's data layer even when no corresponding GA4 collection request had yet been observed. The GA script's async readiness and hit batching made queue inspection alone misleading.

**How to apply:** Wait for the Google tag to load before consuming a newly persisted signup signal; verify the outgoing collection hit has the intended measurement ID and event name, not just a queued gtag call. A successful collection response is still not a substitute for the property owner's signed-in DebugView confirmation.

Coordinate DebugView confirmation with a freshly generated preview signup and identify its timestamp and test-browser device.

**Why:** DebugView's live stream covers only 60 seconds and its archive covers 30 minutes. The selected device can differ from the browser used for the preview test, so an empty live stream alone does not establish that collection failed.

**How to apply:** Give the property owner the fresh event's time, method, and Measurement ID; have them inspect the corresponding minute and debug device. Keep network delivery and signed-in DebugView receipt as separate verification claims.
