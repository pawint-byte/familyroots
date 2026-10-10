---
name: Email request headers
description: A misleading missing-key error can be caused by SDK request options, not broken integration credentials.
---

Check request-header construction before treating a Resend “Missing API Key” response as a disconnected integration.

**Why:** The installed email SDK merged custom request headers over its authentication headers. An idempotency-only header object removed authentication even though the integration credential worked.

**How to apply:** Check the installed SDK's supported options. When using its low-level request method, supply authentication and idempotency headers together. Do not bypass type checks or log credentials.
