---
name: pi-docs-kb
description: Use when a task needs official Pi CLI, provider, settings, session, extension, skill, package, SDK, RPC, platform, or harness documentation facts.
---

# Pi documentation knowledge base

Use the local `pi_docs_search` tool when an implementation task depends on Pi documentation. Search with the smallest precise query first; keep the returned result set bounded.

For an important, ambiguous, or code-shaping claim:

1. Query `pi_docs_search` for the relevant terms.
2. Use `pi-docs show <doc-id-or-url>` when available to inspect the selected page or section around the hit.
3. Preserve the returned official URL and SHA-256 as evidence in the answer or harness-upgrade notes.
4. Do not present a derived snippet as the full official rule, and do not paste the entire documentation into context.

The snapshot is local and may become stale. Check its retrieval metadata and say so when freshness matters; refresh and rebuild the index only when the user explicitly asks for an update or the workflow requires it.

Treat the official page as the source of truth. The skill explains retrieval and citation; it does not replace the documentation or authorize shell, network, package-install, credential, or trust changes.
