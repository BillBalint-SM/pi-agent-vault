# Pi Agent Vault Design

## Goal

Build a portable, source-faithful knowledge base for the complete `pi.dev/docs/latest` documentation and make it available to Pi through a fast local search interface, while providing a reproducible TypeScript extension-development kit without installing the Pi coding agent CLI itself.

## Scope

The project has four deliverables:

1. A reproducible official-documentation crawler that follows every documentation page reachable from `https://pi.dev/docs/latest` and records the canonical URL, title, retrieval timestamp, content hash, and source snapshot.
2. A portable corpus containing an immutable HTML snapshot and an agent-friendly Markdown representation for each page. The source snapshot is the fidelity anchor; derived Markdown is never treated as the authority when validating changes.
3. A local FTS5 index and CLI that answer exact documentation questions without network access at query time.
4. A Pi integration kit consisting of a read-only search extension, a narrowly triggered skill, setup/refresh commands, and a locked TypeScript quality/test toolchain.

The implementation does not install the Pi coding agent CLI globally, configure provider credentials, authenticate a provider, install unreviewed third-party Pi packages, start Docker, or install QEMU.

## Design principles

- **Source of truth:** official `pi.dev` pages are the only accepted documentation source for the corpus. Each indexed record retains its source URL and SHA-256 hash.
- **Faithful preservation:** fetched source bytes remain available unchanged. Search text and Markdown are derived artifacts and carry a pointer back to the source snapshot.
- **Progressive disclosure:** Pi receives only the requested search results, not the full documentation corpus in every prompt.
- **Offline query path:** once built, searches read the local SQLite database and do not call the network.
- **Deterministic refresh:** a refresh is idempotent for unchanged pages, reports additions/removals/changes, and fails loudly on fetch or parse errors.
- **Least privilege:** the Pi-facing tool is read-only; the crawler and index builder are explicit commands, not background processes.
- **Reproducibility:** dependencies are project-local and lockfile-pinned; generated artifacts have a manifest that identifies the exact source set used.

## Architecture

```text
pi.dev/docs/latest
        │
        ▼
  crawler + validator ──► sources/<slug>.html
        │                  sources/<slug>.md
        │                  manifest.json
        ▼
  index builder ────────► index/pi-docs.sqlite (FTS5)
        │
        ├───────────────► pi-docs CLI
        └───────────────► Pi read-only extension/tool
```

The crawler uses the documentation landing page as the root and follows only same-origin links whose normalized path is `/docs/latest` or a child path below `/docs/latest/`. Redirects, fragment identifiers, duplicate URLs, navigation-only links, external links, and assets are recorded in diagnostics but are not indexed as documentation pages. Canonicalization removes fragments, normalizes the trailing slash, and preserves query parameters only when the page itself requires them.

The index stores one document row per page plus one row per searchable section/chunk. Chunks are bounded by Markdown headings where possible, with a fixed maximum character fallback so search results remain small enough to pass to an agent. FTS5 indexes title, heading path, and body with title/headings weighted above body. The query layer uses parameterized FTS5 `MATCH`, BM25 ranking, deterministic tie-breaking by URL and section ordinal, and bounded snippets.

## Repository layout

```text
.
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── eslint.config.mjs
├── prettier.config.mjs
├── vitest.config.ts
├── src/
│   ├── cli.ts
│   ├── vault-check.ts
│   ├── crawl.ts
│   ├── extract.ts
│   ├── index.ts
│   ├── search.ts
│   ├── manifest.ts
│   ├── install-plan.ts
│   ├── paths.ts
│   └── pi-extension.ts
├── tests/
│   ├── canonicalize.test.ts
│   ├── vault-check.test.ts
│   ├── extract.test.ts
│   ├── index.test.ts
│   ├── search.test.ts
│   └── manifest.test.ts
├── scripts/
│   ├── refresh-docs.mjs
│   └── install-pi-integration.ps1
├── pi/
│   └── skills/
│       └── pi-docs-kb/
│           └── SKILL.md
├── docs/
│   └── superpowers/
│       └── specs/
│           ├── 2026-09-12-pi-agent-vault-design.md
│           └── 2026-09-12-vault-check-module-design.md
├── research/
│   └── official-pi-docs.md
└── data/
    ├── sources/
    ├── derived/
    ├── index/
    ├── manifest.json
    └── refresh-report.json
```

The repository contains the builder and configuration. The generated corpus and SQLite database are build outputs under `data/`; a portable copy is exported to the workspace `outputs/` directory for handoff. Machine-level installation copies only the Pi skill and extension into the user Pi resource directory and records the absolute vault path in a generated configuration file. Existing user Pi files are preserved.

## Public interfaces

### CLI

The command is exposed through `npm run pi-docs -- <command>` during development and through a generated `pi-docs.cmd`/PowerShell shim in the installed kit.

```text
pi-docs crawl [--base-url URL] [--data DIR]
pi-docs build-index [--data DIR]
pi-docs refresh [--data DIR]
pi-docs search <query> [--limit N] [--json]
pi-docs show <doc-id-or-url> [--section N]
pi-docs stats [--json]
pi-docs benchmark [--iterations N] [--json]
pi-docs check
```

`search` returns, for every result, the page title, heading path, bounded snippet, score, canonical URL, relative snapshot path, and document hash. `--json` is stable machine-readable output for the Pi extension. Invalid FTS syntax is converted to a safe literal search rather than surfacing a raw SQLite error.

### Search module

```ts
export interface SearchOptions {
  limit?: number;
  includeBody?: boolean;
}

export interface SearchResult {
  docId: string;
  title: string;
  headingPath: string[];
  snippet: string;
  score: number;
  url: string;
  sourcePath: string;
  sha256: string;
}

export function searchDocs(
  dbPath: string,
  query: string,
  options?: SearchOptions,
): SearchResult[];
```

The function opens the database read-only, uses a short-lived connection per CLI invocation, and never writes during a search. The Pi extension reuses one read-only connection per session only after `session_start`, closes it on `session_shutdown`, and rejects paths outside the configured vault directory.

### Pi extension

The extension exports a default factory compatible with the documented Pi `ExtensionAPI`. It registers one read-only `pi_docs_search` tool with a `typebox` schema and one `/pi-docs` command for human inspection. The tool accepts a query and an optional result limit; it returns source-linked snippets, not generated summaries. The extension contains no shell execution, file mutation, network request, timer, watcher, or child process.

### Pi skill

`pi-docs-kb/SKILL.md` is intentionally narrow. It is invoked when a task concerns Pi CLI behavior, providers, settings, sessions, extensions, skills, packages, SDK/RPC, platform setup, or other Pi documentation. It directs the agent to query `pi_docs_search`, validate important details with `pi-docs show`, and cite the returned official URL. It does not inline the corpus or restate the documentation.

## Source fidelity and refresh semantics

Each page record contains:

```json
{
  "id": "stable-slug",
  "url": "https://pi.dev/docs/latest/example",
  "title": "Example",
  "retrievedAt": "2026-09-12T00:00:00.000Z",
  "sha256": "...",
  "htmlPath": "sources/example.html",
  "markdownPath": "sources/example.md",
  "contentHash": "..."
}
```

The crawler stores response status, content type, redirect chain, and failure diagnostics in a refresh report. It accepts successful HTML responses only for pages; it rejects a response that is not same-origin, does not match the documentation path, or cannot produce a non-empty article body. A refresh writes to a staging directory, builds and checks the staged index, then atomically replaces the generated data directory. An interrupted refresh therefore leaves the previous usable corpus intact.

The refresh report distinguishes:

- unchanged pages, where the source hash is identical;
- changed pages, where the source hash differs;
- added pages, newly reachable from the root;
- removed pages, present in the previous manifest but no longer reachable;
- errors, which block publication of the new snapshot.

## Performance decisions

- Use Node 26's built-in `node:sqlite` and FTS5; no native addon or external database server.
- Keep the query database local and read-only after build.
- Store precomputed Markdown section text and metadata so a query does not parse HTML.
- Use one bounded result payload by default; full pages are fetched only through `show`.
- Enable SQLite WAL during build, then run `VACUUM`/optimize before publishing the immutable query copy.
- Measure cold and warm query latency over a fixed representative query set and record p50/p95 in the check report.
- Do not add embeddings until lexical search fails a measured acceptance case; a future hybrid index must remain optional and cannot replace the exact source index.

## Development toolchain

The repository uses a local, lockfile-pinned toolchain:

- Node.js 26 runtime already present on the machine;
- TypeScript and Node type definitions;
- `tsx` for running TypeScript entry points during development;
- ESLint with `typescript-eslint` using flat config;
- Prettier for formatting;
- Vitest for unit and integration tests;
- `typebox` for the Pi tool schema;
- the official Pi coding-agent package as a development-only type/runtime compatibility dependency for extension checking, never as a global CLI installation.

The package scripts are:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run check
npm run pi-docs -- --help
```

`npm run check` runs formatting check, lint, typecheck, and the full Vitest suite. Network access is limited to crawl/refresh commands; tests use fixtures and do not depend on the live website.

## Error handling and safety

- No credentials are read or written by the crawler, indexer, CLI, or extension.
- All filesystem writes are constrained to the repository data directory, the explicitly selected portable output directory, or the Pi user resource directory during installation.
- The installer never overwrites an existing file without first creating a timestamped backup in the same Pi resource subtree.
- A pre-existing `~/.pi/agent/AGENTS.md` is not modified automatically. The installer creates a separate skill and a configuration pointer; any global instruction opt-in is documented as a manual step.
- Third-party package installation is not part of the runtime path. The extension uses only the official Pi imports, `typebox`, and Node built-ins.
- A missing or unreadable index makes the Pi tool return a clear remediation message; it does not attempt a network fetch.
- Symlink/junction escapes are rejected when resolving the configured vault path.

## Validation and completion criteria

The implementation is complete only when all of the following are evidenced:

1. The crawler's manifest contains every reachable official latest-documentation page and no off-scope page.
2. Every manifest entry has a stored HTML snapshot, derived Markdown, canonical URL, and matching SHA-256.
3. The index builder is reproducible from the staged corpus, and `pi-docs check` validates schema, counts, hashes, source links, and FTS integrity.
4. Representative searches cover CLI flags, settings keys, extension APIs, skills, packages, security, Windows, SDK/RPC, and session formats; each returns the expected official page.
5. CLI `search`, `show`, `stats`, and `check` work without network access after the build.
6. The Pi extension passes TypeScript checking and unit tests, uses the documented `typebox` schema shape, and exposes no write/network/shell path.
7. The refresh path preserves the previous published corpus on a failed staged build.
8. `npm run check` exits zero and a fresh latency report records the measured cold/warm p50 and p95 for the fixed query set.
9. The portable output includes a README with install, refresh, search, rollback, and source-fidelity instructions.

## Non-goals

- Installing or configuring the Pi coding agent itself.
- Mirroring non-documentation Pi news, packages, models, or arbitrary GitHub repositories into the official corpus.
- Translating or editorially rewriting the official content inside the source corpus.
- Running a background daemon, hosted search service, vector database, or telemetry collector.
- Automatically trusting arbitrary project-local Pi extensions or packages.

## Official references

- Pi documentation index: https://pi.dev/docs/latest
- Pi quickstart: https://pi.dev/docs/latest/quickstart
- Pi usage and CLI: https://pi.dev/docs/latest/usage
- Pi extensions: https://pi.dev/docs/latest/extensions
- Pi skills: https://pi.dev/docs/latest/skills
- Pi packages: https://pi.dev/docs/latest/packages
- Pi Windows setup: https://pi.dev/docs/latest/windows
- Pi containerization: https://pi.dev/docs/latest/containerization
- Pi SDK: https://pi.dev/docs/latest/sdk
- Official source repository: https://github.com/earendil-works/pi
