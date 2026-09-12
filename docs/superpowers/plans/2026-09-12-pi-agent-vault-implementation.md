# Pi Agent Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a source-faithful offline Pi documentation corpus, a fast SQLite FTS5 search CLI, and a read-only Pi extension/skill installation kit without installing the Pi coding agent CLI globally.

**Architecture:** Crawl only same-origin pages below `/docs/latest`, preserve response HTML as the fidelity anchor, derive Markdown and heading-bounded sections, and build an immutable SQLite FTS5 database. Expose the database through `pi-docs` and a Pi `pi_docs_search` tool that returns bounded source-linked snippets on demand.

**Tech Stack:** Node.js 26 built-ins (`fetch`, `node:sqlite`, `node:fs`, `node:path`), TypeScript, `linkedom` for DOM extraction, `turndown` for derived Markdown, ESLint + `typescript-eslint`, Prettier, Vitest, `tsx`, `typebox`, and the official `@earendil-works/pi-coding-agent` package as a local development-only compatibility dependency for extension typechecking.

**Spec:** `docs/superpowers/specs/2026-09-12-pi-agent-vault-design.md`

## Global Constraints

- Official `pi.dev` pages are the only accepted documentation source for the corpus.
- Fetched source bytes remain unchanged; derived Markdown and search chunks are not the source of truth.
- Query-time search is local and offline; the extension never performs network or shell operations.
- Refresh writes to a staging directory and publishes only after manifest and index checks pass.
- All filesystem paths are explicit and constrained to the vault, portable output, or Pi resource directory.
- The Pi coding agent CLI is not installed globally; no provider credentials are read or written.
- The default search result is bounded and source-linked; full pages are loaded only by `show`.
- Tests use fixtures and do not depend on the live website.
- Existing files under the user's Pi directory are preserved and backed up before installation changes.

---

### Task 1: Scaffold the reproducible TypeScript project

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/paths.ts`
- Create: `tests/paths.test.ts`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Produces `VaultPaths` and `resolveVaultPaths(root: string): VaultPaths` for every later module.
- Produces `npm run check`, which runs format check, lint, typecheck, and Vitest.

- [ ] **Step 1: Write the failing path-resolution tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../src/paths.js";

describe("resolveVaultPaths", () => {
  it("derives all generated locations below the selected root", () => {
    const paths = resolveVaultPaths("C:/vault");
    expect(paths.sourcesDir).toBe("C:/vault/sources");
    expect(paths.indexPath).toBe("C:/vault/index/pi-docs.sqlite");
    expect(paths.manifestPath).toBe("C:/vault/manifest.json");
  });

  it("rejects an empty or relative root", () => {
    expect(() => resolveVaultPaths("")).toThrow(/root/i);
    expect(() => resolveVaultPaths("vault")).toThrow(/absolute/i);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm test -- --run tests/paths.test.ts`

Expected: FAIL because `src/paths.ts` and the project test configuration do not yet exist.

- [ ] **Step 3: Create the project configuration and minimal path module**

Use NodeNext modules and strict TypeScript. Define:

```ts
export interface VaultPaths {
  root: string;
  sourcesDir: string;
  derivedDir: string;
  indexDir: string;
  indexPath: string;
  manifestPath: string;
  reportPath: string;
}

export function resolveVaultPaths(root: string): VaultPaths;
```

Add scripts named `format:check`, `lint`, `typecheck`, `test`, `check`, and `pi-docs`. Add runtime dependencies `linkedom` and `turndown`; add development dependencies `@types/node`, `@types/turndown`, `@earendil-works/pi-coding-agent`, `eslint`, `typescript-eslint`, `prettier`, `tsx`, `typescript`, `typebox`, and `vitest`.

- [ ] **Step 4: Run the focused test and the configuration checks**

Run: `npm test -- --run tests/paths.test.ts`

Expected: PASS with 2 tests.

Run: `npm run typecheck`

Expected: PASS with exit code 0.

- [ ] **Step 5: Commit the scaffold**

```text
git add package.json package-lock.json tsconfig.json eslint.config.mjs prettier.config.mjs vitest.config.ts src/paths.ts tests/paths.test.ts .gitignore README.md
git commit -m "build: scaffold pi agent vault"
```

### Task 2: Implement source URL discovery, fetching, extraction, and manifest records

**Files:**
- Create: `src/manifest.ts`
- Create: `src/extract.ts`
- Create: `src/crawl.ts`
- Create: `tests/canonicalize.test.ts`
- Create: `tests/extract.test.ts`
- Create: `tests/fixtures/docs-index.html`
- Create: `tests/fixtures/quickstart.html`
- Create: `tests/fixtures/invalid-response.txt`
- Create: `research/official-pi-docs.md` (retain the research sidecar report)

**Interfaces:**
- `canonicalizeDocsUrl(input: string, baseUrl: URL): URL | null` accepts only the normalized `/docs/latest` subtree on the base origin.
- `extractPage(html: string, url: string): ExtractedPage` returns title, article HTML, derived Markdown, heading sections, and discovered links.
- `crawlDocs(options: CrawlOptions): Promise<CrawlResult>` returns a staged corpus and a `RefreshReport` without publishing it.
- `ManifestEntry` contains `id`, `url`, `title`, `retrievedAt`, `sha256`, `htmlPath`, `markdownPath`, and `contentHash`.

- [ ] **Step 1: Write canonicalization and extraction tests against fixtures**

```ts
it("keeps latest documentation links and removes fragments", () => {
  expect(canonicalizeDocsUrl("/docs/latest/usage#sessions", new URL("https://pi.dev/docs/latest"))?.href)
    .toBe("https://pi.dev/docs/latest/usage");
});

it("rejects external, asset, and off-version links", () => {
  const base = new URL("https://pi.dev/docs/latest");
  expect(canonicalizeDocsUrl("https://example.com/docs/latest", base)).toBeNull();
  expect(canonicalizeDocsUrl("/docs/old/usage", base)).toBeNull();
  expect(canonicalizeDocsUrl("/favicon.ico", base)).toBeNull();
});

it("extracts article content without navigation or footer text", () => {
  const page = extractPage(fixtureHtml, "https://pi.dev/docs/latest/quickstart");
  expect(page.title).toBe("Quickstart");
  expect(page.markdown).toContain("Install");
  expect(page.markdown).not.toContain("Search documentation");
  expect(page.sections.some((section) => section.headingPath.includes("Authenticate"))).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run: `npm test -- --run tests/canonicalize.test.ts tests/extract.test.ts`

Expected: FAIL because the crawl, extraction, and manifest modules do not yet exist.

- [ ] **Step 3: Implement URL normalization and extraction**

Use `linkedom` to parse HTML. Select the main article/content region, remove navigation, search controls, footer, scripts, styles, SVGs, and decorative elements from the derived representation, and retain headings, paragraphs, lists, tables, links, and code blocks. Preserve the original response bytes separately before parsing. Use `turndown` with fenced-code and table rules for Markdown. Hash bytes with `crypto.createHash("sha256")` and hash normalized Markdown as `contentHash`.

- [ ] **Step 4: Implement staged crawling and manifest persistence**

Use the global `fetch` with an explicit `User-Agent`, a bounded concurrency of 4, a per-request timeout of 20 seconds, and a visited-URL set. Follow links breadth-first, store each successful HTML response in `sources/<stable-slug>.html`, store the derived Markdown beside it, and write `manifest.json` only after all pages have been fetched. Fail the crawl on any page-fetch or extraction error rather than silently omitting it. Record added, changed, removed, unchanged, and error entries in `refresh-report.json`.

- [ ] **Step 5: Run extraction and fixture tests**

Run: `npm test -- --run tests/canonicalize.test.ts tests/extract.test.ts`

Expected: PASS with all canonicalization and extraction cases.

- [ ] **Step 6: Commit the crawler core**

```text
git add src/manifest.ts src/extract.ts src/crawl.ts tests/canonicalize.test.ts tests/extract.test.ts tests/fixtures research/official-pi-docs.md
git commit -m "feat: crawl and preserve official pi docs"
```

### Task 3: Build the SQLite FTS5 index and deterministic search API

**Files:**
- Create: `src/index.ts`
- Create: `src/search.ts`
- Create: `tests/index.test.ts`
- Create: `tests/search.test.ts`

**Interfaces:**
- `buildIndex(options: BuildIndexOptions): BuildIndexResult` creates a new SQLite database from the staged manifest and sections.
- `searchDocs(dbPath: string, query: string, options?: SearchOptions): SearchResult[]` opens the database read-only and returns bounded, source-linked results.
- `SearchResult` includes `docId`, `title`, `headingPath`, `snippet`, `score`, `url`, `sourcePath`, and `sha256`.

- [ ] **Step 1: Write FTS5 schema, ranking, escaping, and offline-search tests**

```ts
it("returns a heading match before an unrelated body match", () => {
  const results = searchDocs(dbPath, "project trust", { limit: 5 });
  expect(results[0]?.title).toBe("Using Pi");
  expect(results[0]?.headingPath.join("/")).toMatch(/Project Trust/);
});

it("turns invalid FTS syntax into a literal search", () => {
  expect(() => searchDocs(dbPath, '"unclosed', { limit: 5 })).not.toThrow();
});

it("opens the database read-only and does not require network access", () => {
  const results = searchDocs(dbPath, "extensions", { limit: 3 });
  expect(results.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run: `npm test -- --run tests/index.test.ts tests/search.test.ts`

Expected: FAIL because the index and search modules do not yet exist.

- [ ] **Step 3: Implement the normalized schema and builder**

Create `documents` and `sections` tables plus an external-content FTS5 table:

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  html_path TEXT NOT NULL,
  markdown_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  content_hash TEXT NOT NULL
);
CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(id),
  ordinal INTEGER NOT NULL,
  heading_path TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE VIRTUAL TABLE sections_fts USING fts5(
  title,
  heading_path,
  body,
  content=sections,
  content_rowid=id,
  tokenize='unicode61'
);
```

Insert the page title into the `title` column for every section, query with `bm25(sections_fts, 5.0, 3.0, 1.0)`, and use `snippet()` for bounded context. Run `optimize` before publishing. Use explicit SQL transactions and `db.close()` in all build paths.

- [ ] **Step 4: Implement safe query normalization and read-only search**

Tokenize user input into quoted FTS terms, escape embedded quotes, fall back to a literal `OR` query for malformed syntax, cap `limit` at 20, cap snippets at 1,200 characters, and sort ties by URL then section ordinal. Resolve source paths only after validating that they remain below the configured vault root.

- [ ] **Step 5: Run the focused index/search tests**

Run: `npm test -- --run tests/index.test.ts tests/search.test.ts`

Expected: PASS with deterministic ordering, bounded output, and zero network calls.

- [ ] **Step 6: Commit the FTS5 implementation**

```text
git add src/index.ts src/search.ts tests/index.test.ts tests/search.test.ts
git commit -m "feat: add offline sqlite fts search"
```

### Task 4: Add the CLI, staged refresh, and integrity checks

**Files:**
- Create: `src/cli.ts`
- Create: `scripts/refresh-docs.mjs`
- Modify: `package.json`
- Create: `tests/cli.test.ts`
- Create: `tests/refresh.test.ts`

**Interfaces:**
- CLI commands: `crawl`, `build-index`, `refresh`, `search`, `show`, `stats`, `benchmark`, and `check`.
- `refresh` builds in a temporary sibling directory and atomically replaces the previous published data directory only after checks pass.
- `check` validates manifest hashes, file existence, page scope, database row counts, FTS integrity, and source-link presence.

- [ ] **Step 1: Write CLI behavior and rollback tests**

```ts
it("search prints bounded JSON with source links", async () => {
  const result = await runCli(["search", "project trust", "--json", "--data", fixtureDataDir]);
  const payload = JSON.parse(result.stdout) as { results: Array<{ url: string; snippet: string }> };
  expect(payload.results[0].url).toMatch(/^https:\/\/pi\.dev\/docs\/latest/);
  expect(payload.results[0].snippet.length).toBeLessThanOrEqual(1200);
});

it("failed refresh leaves the previously published index intact", async () => {
  await expect(runCli(["refresh", "--base-url", unreachableUrl, "--data", publishedDir]))
    .rejects.toThrow();
  expect(await readPublishedManifest(publishedDir)).toEqual(previousManifest);
});
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run: `npm test -- --run tests/cli.test.ts tests/refresh.test.ts`

Expected: FAIL because the CLI and refresh orchestration do not yet exist.

- [ ] **Step 3: Implement argument parsing and commands**

Use a small internal parser rather than adding a command framework. Accept `--data`, `--out`, `--base-url`, `--limit`, `--json`, and `--section`; reject unknown flags with a usage message and exit code 2. `search`, `show`, `stats`, and `check` use the existing modules. `show` reads only a manifest-selected Markdown or HTML file after path validation.

- [ ] **Step 4: Implement staging and atomic publication**

Create a sibling staging directory with a random suffix, run crawl and index build there, run `check`, then rename the old published directory to a backup and the staging directory to the published name. On any failure, remove only the staging directory and restore the previous name if a rename already occurred. Keep the latest backup until the next successful refresh.

- [ ] **Step 5: Run CLI, refresh, and full project checks**

Run: `npm test -- --run tests/cli.test.ts tests/refresh.test.ts`

Expected: PASS.

Run: `npm run check`

Expected: PASS with zero formatting, lint, typecheck, or test failures.

- [ ] **Step 6: Commit the CLI and refresh pipeline**

```text
git add src/cli.ts scripts/refresh-docs.mjs tests/cli.test.ts tests/refresh.test.ts package.json
git commit -m "feat: add pi docs cli and safe refresh"
```

### Task 5: Add the Pi read-only extension and narrowly triggered skill

**Files:**
- Create: `src/pi-extension.ts`
- Create: `pi/skills/pi-docs-kb/SKILL.md`
- Create: `tests/pi-extension.test.ts`
- Create: `tests/pi-skill.test.ts`

**Interfaces:**
- The default extension export accepts the documented `ExtensionAPI`.
- Registers `pi_docs_search` with a `typebox` schema containing `query: string` and optional `limit: number`.
- Registers `/pi-docs` for human-readable local search.
- Opens one read-only database connection after `session_start`, closes it at `session_shutdown`, and returns a remediation message when the database is missing.

- [ ] **Step 1: Write extension contract and skill-router tests**

```ts
it("registers only the read-only documentation tool and command", async () => {
  const pi = createFakeExtensionApi();
  await loadExtension(pi, { vaultRoot: fixtureVault });
  expect(pi.registeredTools.map((tool) => tool.name)).toEqual(["pi_docs_search"]);
  expect(pi.registeredCommands.map((command) => command.name)).toEqual(["pi-docs"]);
});

it("skill mentions all Pi-documentation triggers and defers full text", () => {
  const skill = readSkill();
  expect(skill).toMatch(/CLI|providers|settings|sessions|extensions|skills|packages|SDK|RPC/i);
  expect(skill).toContain("pi_docs_search");
  expect(skill).not.toContain("Paste the entire documentation");
});
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run: `npm test -- --run tests/pi-extension.test.ts tests/pi-skill.test.ts`

Expected: FAIL because the extension and skill do not yet exist.

- [ ] **Step 3: Implement the extension with explicit read-only behavior**

Use `Type.Object` from `typebox`; import only official Pi types, `typebox`, Node built-ins, and the local search module. Do not call `fetch`, `bash`, `spawn`, write APIs, timers, or watchers. Return JSON-safe text blocks with title, heading path, snippet, score, URL, and hash. Use `promptSnippet` and `promptGuidelines` to state when the tool should be used.

- [ ] **Step 4: Write the skill using progressive disclosure**

The skill frontmatter must name the skill `pi-docs-kb`. Its body must instruct the agent to query the local tool for Pi-related implementation facts, use `show` for surrounding context, treat the official URL and source hash as evidence, and report when the local snapshot may be stale. Keep the body under 80 lines and do not duplicate the official documentation.

- [ ] **Step 5: Run extension contract, skill, and TypeScript checks**

Run: `npm test -- --run tests/pi-extension.test.ts tests/pi-skill.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with the extension checked against the local official Pi package types.

- [ ] **Step 6: Commit Pi integration**

```text
git add src/pi-extension.ts pi/skills/pi-docs-kb/SKILL.md tests/pi-extension.test.ts tests/pi-skill.test.ts
git commit -m "feat: expose pi docs through readonly extension"
```

### Task 6: Add machine installer, portable export, and user documentation

**Files:**
- Create: `src/install-plan.ts`
- Create: `scripts/install-pi-integration.ps1`
- Modify: `README.md`
- Create: `docs/operations.md`
- Create: `docs/source-policy.md`
- Create: `tests/installer.test.ts`

**Interfaces:**
- `planInstall(input: InstallPlanInput): InstallPlan` returns the exact scoped writes and timestamped backups without mutating the filesystem.
- Installer parameters: `-VaultRoot`, `-PiAgentDir`, `-PortableOutput`, and `-Uninstall`.
- Default `PiAgentDir` resolves to `$env:USERPROFILE\.pi\agent` without overwriting existing files.
- Installer copies the skill, extension, CLI shim, configuration pointer, and generated corpus into the selected locations, creating timestamped backups for collisions.

- [ ] **Step 1: Write installer planning tests**

```ts
it("plans only scoped writes and backs up collisions", () => {
  const plan = planInstall({ vaultRoot, piAgentDir, portableOutput, existingFiles: [existingSkill] });
  expect(plan.writes.every((file) => isBelow(file, piAgentDir) || isBelow(file, portableOutput))).toBe(true);
  expect(plan.backups).toContain(existingSkill);
});

it("does not include auth, session, or provider files", () => {
  const plan = planInstall({ vaultRoot, piAgentDir, portableOutput, existingFiles: [] });
  expect(plan.writes.some((file) => /auth|session|models\.json/i.test(file))).toBe(false);
});
```

The planning module exports these exact types:

```ts
export interface InstallPlanInput {
  vaultRoot: string;
  piAgentDir: string;
  portableOutput: string;
  existingFiles: string[];
}

export interface InstallPlan {
  writes: string[];
  backups: string[];
}

export function planInstall(input: InstallPlanInput): InstallPlan;
```

- [ ] **Step 2: Run the focused installer test and confirm the red state**

Run: `npm test -- --run tests/installer.test.ts`

Expected: FAIL because the installer planning module and PowerShell script do not yet exist.

- [ ] **Step 3: Implement the installer and rollback-safe copy behavior**

The PowerShell script must validate all resolved destination paths before copying, create backups inside the Pi resource subtree, write a `pi-docs-kb.json` pointer containing the absolute vault root and manifest hash, and copy only the read-only extension, skill, and command shim. `-Uninstall` removes only files listed in the pointer and leaves backups, credentials, sessions, and unrelated skills untouched.

- [ ] **Step 4: Implement portable export and operations documentation**

Export `data/sources`, `data/index`, `data/manifest.json`, `data/refresh-report.json`, the CLI shim, `README.md`, and `docs/source-policy.md` to `C:/Users/littl/Documents/Codex/2026-09-12/pi/outputs/pi-agent-vault/`. Document first use, offline search, refresh, integrity checks, install/uninstall, backup recovery, and the fact that Docker/QEMU/API credentials are not configured by this project.

- [ ] **Step 5: Run installer planning and project checks**

Run: `npm test -- --run tests/installer.test.ts`

Expected: PASS.

Run: `npm run check`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the installer and operational docs**

```text
git add scripts/install-pi-integration.ps1 README.md docs/operations.md docs/source-policy.md tests/installer.test.ts
git commit -m "feat: package pi agent vault installation kit"
```

### Task 7: Crawl the live official docs, benchmark, validate, and publish outputs

**Files:**
- Create: `data/sources/*`
- Create: `data/derived/*`
- Create: `data/index/pi-docs.sqlite`
- Create: `data/manifest.json`
- Create: `data/refresh-report.json`
- Create: `docs/validation-report.md`
- Create: `outputs/pi-agent-vault/*` outside the repository checkout

**Interfaces:**
- Produces the final source-faithful corpus and index.
- Produces a validation report containing page counts, hash checks, query cases, and cold/warm p50/p95 latency.

- [ ] **Step 1: Run the live crawl into a staging directory**

Run: `npm run pi-docs -- refresh --base-url https://pi.dev/docs/latest --data data`

Expected: successful publication of a complete manifest and index, with no off-origin or off-version pages.

- [ ] **Step 2: Validate coverage and source fidelity**

Run: `npm run pi-docs -- check --data data`

Expected: exit code 0; every manifest entry has existing HTML/Markdown files, matching SHA-256, a canonical `pi.dev/docs/latest` URL, and a corresponding database row.

- [ ] **Step 3: Run the representative query suite**

Run each query with `--json` and record the first result:

```text
project trust
defaultTools powershell
Type.Object registerTool
pi install package
RPC mode stdin stdout
session format JSONL
containerization Docker
provider API key
```

Expected: every query returns at least one result whose URL is an official `/docs/latest` page and whose snippet contains the queried concept.

- [ ] **Step 4: Benchmark cold and warm search latency**

Run: `npm run pi-docs -- benchmark --data data --iterations 100`

Expected: a report with p50 and p95 for both cold-process and warm-process searches; preserve the measured values rather than asserting a fixed machine-independent threshold.

- [ ] **Step 5: Install the user-level Pi integration**

Run: `pwsh -NoProfile -File scripts/install-pi-integration.ps1 -VaultRoot (Resolve-Path data) -PortableOutput 'C:\Users\littl\Documents\Codex\2026-09-12\pi\outputs\pi-agent-vault'`

Expected: only the scoped Pi skill, read-only extension, CLI shim, and pointer are written; any collision has a timestamped backup.

- [ ] **Step 6: Run the final verification suite**

Run: `npm run check`

Expected: exit code 0 with zero format, lint, typecheck, or test failures.

Run: `git status --short --branch`

Expected: only intended source, test, documentation, and generated data files are present.

- [ ] **Step 7: Commit the validated corpus and report**

```text
git add data docs/validation-report.md
git commit -m "data: publish indexed pi documentation snapshot"
```
