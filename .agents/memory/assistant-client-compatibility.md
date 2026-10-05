---
name: Assistant client compatibility
description: External AI authentication and retry constraints that the API and setup guide must preserve.
---

GPT Actions do not support custom headers other than configured authentication. Keep JSON request IDs available for safe retries; a header-only retry contract cannot serve this client.

API-key authentication in a custom GPT is the GPT's configured credential, not a separate login for each person using it. A GPT carrying a member's personal FamilyRoots key must remain private, never shared or published.

Claude's custom connectors expect a remote MCP server, not a plain OpenAPI URL. Do not advertise the HTTP API as a ready-to-connect MCP endpoint.

**Why:** Official OpenAI production/authentication documentation and Claude connector documentation establish these constraints. Incorrect setup guidance either prevents calls or shares a member's delegated authority.

**How to apply:** Preserve JSON-based idempotency alongside HTTP headers, distinguish personal private API-key setups from per-user OAuth, and verify provider requirements before promising compatibility. The member's own AI remains responsible for member-directed tasks.
