---
name: Safe QA account access
description: Why QA uses isolated verified demo seeding rather than an application-wide email-verification bypass.
---

Prefer an explicitly invoked development-only demo seeder over a runtime
verification bypass. Keep native signup/login verification unchanged.

**Why:** QA has no usable verification inbox. Seeding a new synthetic non-admin
account avoids weakening real-account authentication or depending on mail delivery.

**How to apply:** Follow the opt-in and cleanup instructions in
`docs/qa-demo-account.md`; never import demo accounts into production. Revoke
sessions as well as credentials. Do not clear the password hash to disable a
demo account: that invokes legacy-account recovery mail. Replace it with an
unknown random hash and mark the account unverified instead.

Paid-feature QA may temporarily assign the required tier only to a newly seeded
synthetic development account. Reset its tier during cleanup; never change real
users, production entitlements, or the seeder's normal defaults.

**Why:** Upload and playback verification needs paid access without creating
real subscription charges or permanently granting benefits.

**How to apply:** Restrict any fixture update to the new demo account's exact ID,
clean up its test media/content, reset the tier, and revoke its credentials and
sessions at the end of the verification pass.