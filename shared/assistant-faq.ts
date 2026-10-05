import type { FAQCategory } from "./faq";

export const assistantFaq: FAQCategory = {
  title: "Connect Your Own AI",
  icon: "Shield",
  items: [
    {
      question: "What is Assistant access, and whose AI does it use?",
      answer: [
        "Assistant access lets your own compatible AI tool interact with FamilyRoots to carry out tasks you approve or direct. FamilyRoots does not add a hosted model or a new chatbot for this feature. Your AI uses a revocable key—not your FamilyRoots password—and the site checks your permissions before acting. The AI provider's account requirements, charges, and privacy policies are separate from FamilyRoots.",
      ],
    },
    {
      question: "How do I turn it on and create a key?",
      answer: [
        "Sign in, open ",
        { text: "Account settings", href: "/account/settings" },
        ", and find “Your AI, under your direction.” Enable Assistant access, name your connection, select one tree you own or can edit, and choose its permissions. If you want to say “of member,” select your own claimed profile in that tree; otherwise use exact person IDs. All five write permissions are initially selected—you can turn any off, or turn all off for read-only access. Create the key and copy it immediately. The secret is shown once and cannot be retrieved later.",
      ],
    },
    {
      question: "How do I connect my AI safely?",
      answer: [
        "Your AI client must support authenticated HTTP tools and keep a separate secret for your connection. Use the FamilyRoots website you signed into as the service address. Its API definition is at ",
        { text: "/api/agent/openapi.json", href: "/api/agent/openapi.json", target: "_blank", rel: "noopener noreferrer" },
        ". Import this definition into a supported tool or action, choose API-key authentication using the Authorization: Bearer header, and put your key only in its secure authentication field. Never paste the key into a chat, instructions, source code, shared document, or URL. Start with a read-only call to GET /api/agent/tree. The API returns only your selected tree's names, IDs, and relationship labels. If your tool cannot make authenticated calls, pasting a link into its chat does not connect it.",
      ],
    },
    {
      question: "Can I use ChatGPT with a private custom GPT?",
      answer: [
        "If your ChatGPT account supports creating custom GPTs with Actions, create a personal GPT, open its Actions configuration, and import the FamilyRoots OpenAPI URL. Set authentication to API Key with Bearer and enter your member key in the authentication secret field, not in the GPT's instructions. Keep the GPT private (“Only me”); never share or publish a GPT that uses your personal FamilyRoots key. A shared API-key action would act with your permissions. Each member needs their own private setup and own key. Use the Test control for readMySelectedTree first. For writes, the schema includes a requestId in the JSON body because GPT Actions do not support custom request headers. Your AI should generate a task ID and reuse it only for retries of the identical task. ChatGPT may ask for its own confirmation before a write.",
        { tag: "p", children: [{ text: "OpenAI's Action authentication guide", href: "https://developers.openai.com/api/docs/actions/authentication", target: "_blank", rel: "noopener noreferrer" }] },
      ],
    },
    {
      question: "What about Claude, other chat apps, or an AI coding tool?",
      answer: [
        "Do not assume that every chat app accepts an OpenAPI URL. Claude's custom-connector interface expects a remote MCP server; this release provides a bearer-authenticated HTTP API, not an MCP server or OAuth sign-in connector. The OpenAPI URL is not an MCP server URL. An AI coding tool or another client can use this feature if it supports HTTP tools and secure secret configuration. Give it the public API definition and configure your key outside the chat. Never ask it to discover, read, or print unrelated secrets. If your client has no secure authentication method, do not connect it yet.",
        { tag: "p", children: [{ text: "Claude's connector requirements", href: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp", target: "_blank", rel: "noopener noreferrer" }] },
      ],
    },
    {
      question: "What can I ask my AI to do, and what needs site approval?",
      answer: [
        "Enabled tasks include drafting a person, setting an explicit relationship label, inviting one named person, emailing one named person, and merging two explicitly identified people in the same tree. Ordinary permitted calls run directly. A new person stays hidden as a draft until you accept it in Account settings. Unknown referenced people fail; the AI must not invent relatives. Duplicate names require you to choose exact identities on the site. A changed stored email address also needs confirmation. Bulk email and delete-all requests never run directly: only the tree owner can confirm the exact recipients or people on the site. Delete-all archives people and relationships rather than permanently erasing them. Another member's claimed profile is protected from assistant merges and bulk deletion.",
      ],
    },
    {
      question: "What should my first task look like?",
      answer: [
        "Start with: “Show the names and labels in my selected FamilyRoots tree.” Then try: “Create a draft named Maria, labeled mother of my selected member profile. Do not invent any other people.” Your AI reads the tree to obtain stable IDs, submits the draft with a unique requestId, and reports that it is awaiting your acceptance. Open Account settings, review the proposed person and relationship, and accept or reject. Only acceptance makes Maria visible. For a merge, explicitly specify which profile to keep and which to merge; two matching names alone are not proof that they are the same person.",
      ],
    },
    {
      question: "What information can the AI see, and can it act outside my tree?",
      answer: [
        "A key is tied to one selected tree and its enabled actions. Tree reads expose names, stable IDs, and relationship labels—not a directory of emails, photos, private notes, or hidden drafts. Task results can contain details you supplied, including recipient addresses. It cannot use that key to access another tree, create more keys, or manage your account. FamilyRoots rechecks your current edit rights: if you lose access to the selected tree, the key cannot continue using it. Your chosen AI provider receives the data used in these calls, so review that provider's privacy and retention settings before connecting private family information.",
      ],
    },
    {
      question: "How do monthly review, renew, extend, pause, and revoke work?",
      answer: [
        "The key itself lasts until you revoke it. After 30 days, the site asks you to review the permission. You have a seven-day grace period; if you do not respond, new writes pause. Renew approves another 30 days; Extend adds seven days to the review deadline; Pause writes stops new tasks immediately. Paused keys can still read their selected tree. Revoke blocks both reads and writes and cancels pending drafts or confirmations. A revoked key cannot be renewed—create a new one if you want to reconnect. Revocation cannot unsend an email or undo an already-completed action.",
      ],
    },
    {
      question: "How do I prevent repeated tasks or duplicate emails?",
      answer: [
        "Every write needs a unique requestId in its JSON body, or an Idempotency-Key header for HTTP clients. The same ID with the same request returns its saved result without executing again. Reusing it for a different task fails. If a delivery is uncertain, the API will not resend automatically; check activity and confirm what happened before directing a fresh task. Safety limits are 60 assistant writes per member per minute, 30 email recipients per member per 24 hours, 100 pending tasks per member, and 10 unrevoked keys. These are API safeguards, not new paid plans. Existing member-credit and plan rules still apply.",
      ],
    },
    {
      question: "Where can I review activity, troubleshoot, or stop access?",
      answer: [
        "Open Account settings to view recent activity, approve or reject drafts and confirmations, review each key's tree and permissions, and pause or revoke it. A 401 means the bearer key is missing, invalid, or revoked; 403 means paused access, a disabled permission, or lost tree rights; 402 means existing member credits are exhausted; 404 means a referenced person is not in the selected tree; 409 means a confirmation, ambiguous identity, changed snapshot, or request-ID conflict; 429 means a safety limit; 502 means delivery could not be confirmed and must not be retried automatically. GET /api/agent/health is public and checks that the service responds; it does not test your key. Pending site confirmations expire after seven days. If you lose your key, revoke it and create a replacement.",
      ],
    },
  ],
};
