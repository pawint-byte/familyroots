---
name: Membership visibility and verification
description: User-directed membership discoverability and safe interpretation of billing versus feature access.
---

Member status should be very visible on all pages so members can easily see whether they are free or paid, what kind of membership they have, and access upgrades.

**Why:** The user explicitly asked for this after having difficulty finding account status and purchase controls.

**How to apply:** Preserve a clear signed-in membership display and upgrade access across routes, including Profile and Account Settings. Loading or failed billing checks must not be presented as a confirmed free account.

Admin and included/gift access are not proof of a purchased subscription.

**Why:** Admins can have Legacy feature access without paying. A production purchase also failed to activate access when webhook signatures were rejected.

**How to apply:** Verify the member and customer association against Stripe before recovering a missing paid entitlement. Do not grant access from client-supplied plan names or bypass webhook signature checks. Webhook signing secrets are endpoint-specific, and the Stripe account serves multiple apps.
