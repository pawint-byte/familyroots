---
name: Existing Help chat permissions
description: Distinguishes member-owned external AI access from the requested on-site Help upgrade and its strict confirmation rules.
---

The user's requested upgrade of the existing Help chatbot is separate from external AI access. Help may read only the signed-in member's owned data, with names/counts in owned trees and the member's invitation statuses. It must not expose other members' private emails, trees, or details. Every data-changing Help action needs its own explicit site confirmation. Deletion is limited to items Help itself created.

**Why:** The user explicitly requested these guardrails in their outage/Help report. The earlier external-AI feature's no-new-hosted-chatbot rule does not forbid upgrading the already-existing Help chatbot.

**How to apply:** Keep external-AI grants and Help-session confirmations separate. Preserve normal sign-in, pricing, plan limits, referrals, and public invitation how-to.

A prompt saying “ask for confirmation” is not sufficient to produce a usable confirmation UI. Use narrow action-specific tool schemas and enforce real server-issued confirmation cards for direct write requests, with explicit clarification/refusal paths.

**Why:** Real browser checks found the model could emit irrelevant fields into a broad optional-field schema, or ask for a text “yes” without creating an actionable card.

**How to apply:** Test the actual model-to-card-to-write path. Do not accept a plausible chat answer as evidence that an action was proposed or executed.
