---
name: Uncached compiler verification
description: Incremental diagnostics may remain stale after changes to compiler options.
---

Verify compiler-option changes with an uncached type check before trusting incremental diagnostics.

**Why:** A modern JavaScript target was correctly present in the effective configuration, but an incremental check still reported old Map/Set iteration errors. An uncached check removed those stale diagnostics.

**How to apply:** If diagnostics contradict the effective compiler configuration after an option change, run TypeScript with incremental checking disabled. Do not edit working code merely to satisfy stale cached errors.