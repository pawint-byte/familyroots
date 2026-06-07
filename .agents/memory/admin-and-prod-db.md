---
name: Admin identity & dev/prod DB divergence
description: Why admin feature-gating must key off identity, and the dev-vs-prod database split that hides data-state bugs.
---

# Admin bypass must key off identity, not the `is_admin` DB column

Admin tier/paywall bypass resolves through `subscriptionService.getUserTier`, which now treats a
known admin identity as `legacy` via `isAdminAccount(id, email)` from `server/adminConfig.ts`
(single source of truth; `server/routes.ts` imports the same helper). It still also honors the
`users.isAdmin` DB flag, but does NOT depend on it.

**Why:** The `users.is_admin` column is mutable per-environment. It was `true` in dev but `false`
in production, so the admin (pawint@me.com / 52852375) was still paywalled in prod (e.g. voice
notes locked) even though dev looked fine. Keying off the hardcoded admin id/email makes the bypass
work identically in both environments without a DB write.

**How to apply:** Any new admin-gated path should call `isAdminAccount(id, email)` (or go through
`getUserTier`). When a select feeds `getUserTier`, include `id` and `email` columns so identity
detection works.

# Dev and production use SEPARATE databases

Peter operates primarily in PRODUCTION (familyroots.family). `executeSql` defaults to the DEV
database; pass `environment: "production"` for a READ-ONLY replica of prod. Verifying a row in dev
says nothing about prod. When a "deployed app behaves wrong but dev is fine" bug appears, check
prod data state first — it commonly diverges from dev.
