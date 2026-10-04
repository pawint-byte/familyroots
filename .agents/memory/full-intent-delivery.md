---
name: full-intent-delivery
description: Standing rule for end-to-end delivery verification
---
Standing rule (Andrew via CoS, 2026-09-10): When Andrew asks to do something, complete the FULL INTENT end-to-end. Do not stop at a surface checkbox. Verify it actually works as intended before calling done; surface gaps instead of declaring done early. Example: FAQ content existing in-app is NOT done until /faq is crawlable (real HTML title/H1/Q&A for search).

Do not defer confirmed functional defects solely because they predate the current changes or describe them as harmless cleanup because the build succeeds.

**Why:** Andrew challenged leaving known problems unfixed while handing off paid-traffic readiness work.

**How to apply:** Within ordinary authorized, mission-fit maintenance, fix and verify confirmed defects before declaring readiness; clearly disclose genuine blockers rather than offering optional cleanup for known broken behavior.