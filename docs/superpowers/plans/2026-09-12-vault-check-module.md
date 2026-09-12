# VaultCheck Deep Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all existing vault integrity policy behind one deep `VaultCheck` module without changing reports, CLI behavior, staged publication, corpus contents, or performance.

**Architecture:** Add `src/vault-check.ts` with the two-name interface `checkVault(dataDir: string): CheckReport`, while keeping every validator and the SQLite adapter private. Keep `src/cli.ts` as the command/refresh adapter, re-export the existing names for source compatibility, and make both explicit checks and staged refreshes cross the same module seam.

**Tech Stack:** Node.js 26 built-ins (`node:fs`, `node:path`, `node:sqlite`, `node:crypto`, `node:http`), TypeScript 6 with NodeNext modules, `tsx`, Vitest 5, ESLint, Prettier, PowerShell installer tests, and the existing local SQLite FTS5 index.

**Spec:** `docs/superpowers/specs/2026-09-12-vault-check-module-design.md`

## Global Constraints

- Preserve the exact `checkVault(dataDir: string): CheckReport` interface and the seven existing `CheckReport` fields.
- `src/vault-check.ts` exports only the `checkVault` runtime value and the `CheckReport` type.
- Preserve current report values, recoverable-error behavior, error wording/order, JSON formatting, human output, and exit codes.
- Do not add an integrity rule, typed finding, storage port, filesystem port, second SQLite adapter, asynchronous check, or new dependency.
- Do not change the manifest format, SQLite schema, index builder behavior, search behavior, or corpus contents.
- `checkVault()` performs no network request, filesystem write, or SQLite write and uses one read-only SQLite connection.
- Keep SQL out of document- and section-sized loops; complexity remains linear in documents, sections, and FTS rows.
- The staged check runs before any publication rename, and a failed staged check leaves the published vault byte-for-byte unchanged.
- Tests use temporary local files, loopback-only HTTP when required, and Node's real local SQLite implementation; they never depend on the live documentation site.
- The tracked `data/` tree must remain identical to baseline commit `c2d2298`.
- On the current corpus, post-change median may not exceed 22.08 ms and post-change p95 may not exceed 24.86 ms without investigation and an approved explanation.
- The portable output must contain `src/vault-check.ts`; the machine-installed Pi extension file set does not change.
- Preserve unrelated work. Begin execution only from a clean worktree, and commit each accepted task separately.

---

## File map

### Create

- `src/vault-check.ts` — owns the entire integrity implementation and exposes the small interface.
- `tests/vault-check.test.ts` — tests integrity behavior only through that interface with real local substitutes.

### Modify

- `src/cli.ts` — imports/re-exports `VaultCheck`, removes duplicated integrity implementation, and retains command/refresh adapter behavior.
- `tests/cli.test.ts` — tests only CLI translation, output, exit codes, and compatibility re-export.
- `tests/refresh.test.ts` — proves a staged integrity failure crosses the shared seam and cannot publish.
- `src/install-plan.ts` — declares `src/vault-check.ts` as a portable write.
- `scripts/install-pi-integration.ps1` — copies `src/vault-check.ts` into portable output.
- `tests/installer.test.ts` — proves planned and materialized portable inclusion.
- `docs/superpowers/specs/2026-09-12-pi-agent-vault-design.md` — updates the repository layout.
- `docs/operations.md` — states that explicit and staged checks use the same integrity module.
- `docs/validation-report.md` — records final tests, live report, performance, and portable evidence.

### Deliberately unchanged

- `src/index.ts` — keeps the current schema, index implementation, and `resolveManifestPath` export.
- `src/paths.ts`, `src/manifest.ts`, `src/extract.ts`, and `src/crawl.ts` — remain implementation dependencies with unchanged interfaces.
- `data/**` — remains byte-for-byte unchanged.
- `package.json` and `package-lock.json` — no dependency or script change is needed.
- `src/pi-extension.ts` and the machine-installed Pi extension files — do not import `VaultCheck` and remain unchanged.

---

### Task 1: Add the deep `VaultCheck` module and its interface tests

**Files:**

- Create: `src/vault-check.ts`
- Create: `tests/vault-check.test.ts`
- Reference without modification: `src/cli.ts:34-42,105-128,270-368,643-820,872-874`
- Reference without modification: `tests/test-vault.ts`

**Interfaces:**

- Consumes: `canonicalizeDocsUrl`, `sectionizeMarkdown`, `resolveManifestPath`, `hashBytes`, `readManifest`, `resolveVaultPaths`, and Node's `DatabaseSync`.
- Produces: `checkVault(dataDir: string): CheckReport` and the exact `CheckReport` type from the approved spec.
- Leaves the current copy in `src/cli.ts` temporarily so Task 2 can prove that both callers are rewired to the new seam.

- [ ] **Step 1: Create the failing interface test file**

Create `tests/vault-check.test.ts` with the following complete test surface:

```ts
import { DatabaseSync } from "node:sqlite";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../src/index.js";
import {
  hashBytes,
  readManifest,
  writeManifest,
  type Manifest,
} from "../src/manifest.js";
import { checkVault } from "../src/vault-check.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault | undefined;
const extraRoots: string[] = [];

afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
  for (const root of extraRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createBuiltFixture(): TestVault {
  fixture = createIndexFixture();
  buildIndex({ dataDir: fixture.root });
  return fixture;
}

function editManifest(vault: TestVault, mutate: (manifest: Manifest) => void): void {
  const manifestPath = path.join(vault.root, "manifest.json");
  const manifest = readManifest(manifestPath);
  mutate(manifest);
  writeManifest(manifestPath, manifest);
}

function requireTwoEntries(manifest: Manifest) {
  const first = manifest.entries[0];
  const second = manifest.entries[1];
  if (!first || !second) throw new Error("Fixture requires two manifest entries");
  return { first, second };
}

function editIndex(vault: TestVault, mutate: (db: DatabaseSync) => void): void {
  const db = new DatabaseSync(vault.dbPath);
  try {
    mutate(db);
  } finally {
    db.close();
  }
}

interface SectionRow {
  id: number | bigint;
  title: string;
  heading_path: string;
  body: string;
}

function replaceFtsRows(vault: TestVault, omitFirst: boolean, addOrphan: boolean): void {
  editIndex(vault, (db) => {
    const rows = db
      .prepare("SELECT id, title, heading_path, body FROM sections ORDER BY id")
      .all() as unknown as SectionRow[];
    db.exec("DROP TABLE sections_fts");
    db.exec(
      "CREATE VIRTUAL TABLE sections_fts USING fts5(title, heading_path, body, tokenize='unicode61')",
    );
    const insert = db.prepare(
      "INSERT INTO sections_fts(rowid, title, heading_path, body) VALUES (?, ?, ?, ?)",
    );
    for (const [index, row] of rows.entries()) {
      if (omitFirst && index === 0) continue;
      insert.run(row.id, row.title, row.heading_path, row.body);
    }
    if (addOrphan) insert.run(9999, "Orphan", "Orphan", "Orphan body");
  });
}

function fileDigests(vault: TestVault): Record<string, string> {
  const relativePaths = [
    "manifest.json",
    "index/pi-docs.sqlite",
    "sources/extensions.html",
    "sources/extensions.md",
    "sources/using-pi.html",
    "sources/using-pi.md",
  ];
  return Object.fromEntries(
    relativePaths.map((relativePath) => [
      relativePath,
      hashBytes(readFileSync(path.join(vault.root, relativePath))),
    ]),
  );
}

describe("checkVault", () => {
  it("exports only the deep runtime interface", async () => {
    const module = await import("../src/vault-check.js");
    expect(Object.keys(module).sort()).toEqual(["checkVault"]);
  });

  it("returns the exact successful report for a valid vault", () => {
    const vault = createBuiltFixture();

    expect(checkVault(vault.root)).toEqual({
      ok: true,
      dataDir: path.resolve(vault.root).replaceAll("\\", "/"),
      documents: 2,
      sections: 6,
      ftsRows: 6,
      sourceLinks: 2,
      errors: [],
    });
  });

  it("reports a malformed manifest without throwing", () => {
    const vault = createBuiltFixture();
    writeFileSync(path.join(vault.root, "manifest.json"), "{}\n", "utf8");

    const report = checkVault(vault.root);

    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatch(/^manifest: Invalid manifest:/);
  });

  it("reports an invalid manifest root URL before entry errors", () => {
    const vault = createBuiltFixture();
    editManifest(vault, (manifest) => {
      manifest.rootUrl = "not a URL";
    });

    const report = checkVault(vault.root);

    expect(report.sourceLinks).toBe(0);
    expect(report.errors[0]).toBe("manifest rootUrl is not a valid URL: not a URL");
    expect(report.errors[1]).toMatch(/^entry 0: cannot validate source link/);
  });

  it.each([
    {
      name: "HTML SHA-256",
      relativePath: "sources/using-pi.html",
      suffix: "<!-- tampered -->",
      expected: /HTML SHA-256 mismatch/,
    },
    {
      name: "Markdown content hash",
      relativePath: "sources/using-pi.md",
      suffix: "\nTampered Markdown",
      expected: /Markdown content hash mismatch/,
    },
  ])("reports a $name mismatch", ({ relativePath, suffix, expected }) => {
    const vault = createBuiltFixture();
    appendFileSync(path.join(vault.root, relativePath), suffix, "utf8");

    const report = checkVault(vault.root);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => expected.test(error))).toBe(true);
  });

  it.each([
    {
      name: "document id",
      mutate: (manifest: Manifest) => {
        const { first, second } = requireTwoEntries(manifest);
        second.id = first.id;
      },
      expected: /duplicate document id/,
    },
    {
      name: "document URL",
      mutate: (manifest: Manifest) => {
        const { first, second } = requireTwoEntries(manifest);
        second.url = first.url;
      },
      expected: /duplicate document URL/,
    },
  ])("reports a duplicate $name", ({ mutate, expected }) => {
    const vault = createBuiltFixture();
    editManifest(vault, mutate);

    const report = checkVault(vault.root);

    expect(report.errors.some((error) => expected.test(error))).toBe(true);
  });

  it("rejects a lexical source path escape", () => {
    const vault = createBuiltFixture();
    editManifest(vault, (manifest) => {
      const { first } = requireTwoEntries(manifest);
      first.htmlPath = "../escaped.html";
    });

    expect(checkVault(vault.root).errors[0]).toMatch(/Path escapes vault root/);
  });

  it("rejects a source path that resolves through a link outside the vault", () => {
    const vault = createBuiltFixture();
    const outside = mkdtempSync(path.join(os.tmpdir(), "pi-vault-outside-"));
    extraRoots.push(outside);
    const outsideBytes = new TextEncoder().encode("<article>outside</article>");
    writeFileSync(path.join(outside, "escaped.html"), outsideBytes);
    symlinkSync(
      outside,
      path.join(vault.root, "sources", "linked-outside"),
      process.platform === "win32" ? "junction" : "dir",
    );
    editManifest(vault, (manifest) => {
      const { first } = requireTwoEntries(manifest);
      first.htmlPath = "sources/linked-outside/escaped.html";
      first.sha256 = hashBytes(outsideBytes);
    });

    expect(checkVault(vault.root).errors[0]).toMatch(/path resolves outside vault/);
  });

  it.each([
    {
      name: "missing",
      mutate: (vault: TestVault) => rmSync(vault.dbPath, { force: true }),
      expected: /index: missing/,
    },
    {
      name: "corrupt",
      mutate: (vault: TestVault) => writeFileSync(vault.dbPath, "not sqlite", "utf8"),
      expected: /^index:/,
    },
  ])("reports a $name SQLite index", ({ mutate, expected }) => {
    const vault = createBuiltFixture();
    mutate(vault);

    const report = checkVault(vault.root);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => expected.test(error))).toBe(true);
  });

  it.each([
    {
      name: "mismatched",
      mutate: (db: DatabaseSync) =>
        db.prepare("UPDATE documents SET title = ? WHERE id = ?").run("Tampered", "using-pi"),
      expected: /document mismatch for using-pi: title/,
    },
    {
      name: "missing",
      mutate: (db: DatabaseSync) => {
        db.exec("PRAGMA foreign_keys = OFF");
        db.prepare("DELETE FROM documents WHERE id = ?").run("using-pi");
      },
      expected: /manifest document using-pi is missing from SQLite/,
    },
    {
      name: "orphan",
      mutate: (db: DatabaseSync) =>
        db
          .prepare(
            "INSERT INTO documents (id, url, title, html_path, markdown_path, sha256, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            "orphan",
            "https://pi.dev/docs/latest/orphan",
            "Orphan",
            "sources/orphan.html",
            "sources/orphan.md",
            "0".repeat(64),
            "1".repeat(64),
          ),
      expected: /orphan document row orphan/,
    },
  ])("reports a $name document row", ({ mutate, expected }) => {
    const vault = createBuiltFixture();
    editIndex(vault, (db) => {
      mutate(db);
    });

    expect(checkVault(vault.root).errors.some((error) => expected.test(error))).toBe(true);
  });

  it.each([
    {
      name: "mismatched",
      mutate: (db: DatabaseSync) =>
        db
          .prepare("UPDATE sections SET body = ? WHERE doc_id = ? AND ordinal = 0")
          .run("Tampered section", "using-pi"),
      expected: /section mismatch for using-pi at ordinal 0/,
    },
    {
      name: "missing",
      mutate: (db: DatabaseSync) =>
        db.prepare("DELETE FROM sections WHERE doc_id = ? AND ordinal = 0").run("using-pi"),
      expected: /section count mismatch for using-pi/,
    },
    {
      name: "orphan",
      mutate: (db: DatabaseSync) => {
        db.exec("PRAGMA foreign_keys = OFF");
        db
          .prepare(
            "INSERT INTO sections (doc_id, ordinal, heading_path, title, body) VALUES (?, ?, ?, ?, ?)",
          )
          .run("orphan", 0, "Orphan", "Orphan", "Orphan body");
      },
      expected: /orphan sections for document orphan/,
    },
  ])("reports a $name section row", ({ mutate, expected }) => {
    const vault = createBuiltFixture();
    editIndex(vault, (db) => {
      mutate(db);
    });

    expect(checkVault(vault.root).errors.some((error) => expected.test(error))).toBe(true);
  });

  it.each([
    { name: "missing", omitFirst: true, addOrphan: false, expected: "missing=1, orphan=0" },
    { name: "orphan", omitFirst: false, addOrphan: true, expected: "missing=0, orphan=1" },
  ])("reports a $name FTS relationship", ({ omitFirst, addOrphan, expected }) => {
    const vault = createBuiltFixture();
    replaceFtsRows(vault, omitFirst, addOrphan);

    expect(checkVault(vault.root).errors).toContain(`index: FTS row mismatch (${expected})`);
  });

  it("collects independent source errors in manifest order", () => {
    const vault = createBuiltFixture();
    appendFileSync(path.join(vault.root, "sources", "using-pi.html"), "tampered", "utf8");
    appendFileSync(path.join(vault.root, "sources", "extensions.md"), "tampered", "utf8");

    const report = checkVault(vault.root);

    expect(report.errors.slice(0, 2)).toEqual([
      "entry 0: HTML SHA-256 mismatch for https://pi.dev/docs/latest/using-pi",
      "entry 1: Markdown content hash mismatch for https://pi.dev/docs/latest/extensions",
    ]);
  });

  it("does not modify manifest, source, or SQLite bytes", () => {
    const vault = createBuiltFixture();
    const before = fileDigests(vault);

    expect(checkVault(vault.root).ok).toBe(true);

    expect(fileDigests(vault)).toEqual(before);
  });

  it("closes the SQLite connection after success and query failure", () => {
    const vault = createBuiltFixture();
    const movedPath = `${vault.dbPath}.moved`;
    const moveRoundTrip = () => {
      renameSync(vault.dbPath, movedPath);
      renameSync(movedPath, vault.dbPath);
    };

    expect(checkVault(vault.root).ok).toBe(true);
    expect(moveRoundTrip).not.toThrow();

    editIndex(vault, (db) => {
      db.exec("DROP TABLE sections_fts");
    });
    expect(checkVault(vault.root).errors.some((error) => error.startsWith("index:"))).toBe(true);
    expect(moveRoundTrip).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the new tests and confirm the missing-module failure**

Run: `npm run test -- tests/vault-check.test.ts`

Expected: FAIL during module resolution because `src/vault-check.ts` does not exist. No test may pass through the old `src/cli.ts` implementation.

- [ ] **Step 3: Create `src/vault-check.ts` from the existing implementation**

Start the file with these exact imports and declarations:

```ts
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalizeDocsUrl } from "./crawl.js";
import { sectionizeMarkdown, type ExtractedSection } from "./extract.js";
import { resolveManifestPath } from "./index.js";
import { hashBytes, readManifest, type Manifest, type ManifestEntry } from "./manifest.js";
import { resolveVaultPaths } from "./paths.js";

export interface CheckReport {
  ok: boolean;
  dataDir: string;
  documents: number;
  sections: number;
  ftsRows: number;
  sourceLinks: number;
  errors: string[];
}

interface ExpectedDocument {
  entry: ManifestEntry;
  sections: ExtractedSection[];
}

interface IndexedDocumentRow {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  html_path?: unknown;
  markdown_path?: unknown;
  sha256?: unknown;
  content_hash?: unknown;
}

interface IndexedSectionRow {
  doc_id?: unknown;
  ordinal?: unknown;
  heading_path?: unknown;
  title?: unknown;
  body?: unknown;
}

type IndexedDocumentField = Exclude<keyof ManifestEntry, "retrievedAt">;
```

Copy the following declarations verbatim from `src/cli.ts` at baseline commit `c2d2298`, preserving their current order and implementation:

1. `checkVault` from lines 270-368.
2. `validateManifestEntry` from lines 643-678.
3. `validateIndexedDocuments` from lines 680-734.
4. `validateIndexedSections` from lines 736-793.
5. `resolveVerifiedPath` and `realpathForCheck` from lines 795-808.
6. `countRows` from lines 814-820.
7. `errorMessage` from lines 872-874.

Keep only `CheckReport` and `checkVault` exported. Do not remove the original declarations from `src/cli.ts` in this task.

- [ ] **Step 4: Run the deep module tests and confirm all integrity classes pass**

Run: `npm run test -- tests/vault-check.test.ts`

Expected: PASS with 23 test cases. The two FTS cases must report exactly `missing=1, orphan=0` and `missing=0, orphan=1`.

- [ ] **Step 5: Verify type safety, runtime exports, and unchanged existing CLI behavior**

Run: `npm run typecheck`

Expected: PASS with exit code 0.

Run: `npm run test -- tests/cli.test.ts tests/index.test.ts`

Expected: PASS. The temporary duplicate implementation must still produce the same current CLI behavior.

Run:

```powershell
node --import=tsx/esm -e "import('./src/vault-check.ts').then((module) => console.log(JSON.stringify(Object.keys(module).sort())))"
```

Expected stdout: `["checkVault"]`.

- [ ] **Step 6: Commit the independently tested deep module**

```text
git add src/vault-check.ts tests/vault-check.test.ts
git commit -m "refactor: add deep vault check module"
```

---

### Task 2: Route CLI and refresh behavior through the shared seam

**Files:**

- Modify: `src/cli.ts:1-128,214-368,643-820`
- Modify: `tests/cli.test.ts`
- Modify: `tests/refresh.test.ts`
- Test: `tests/vault-check.test.ts`

**Interfaces:**

- Consumes: `checkVault(dataDir: string): CheckReport` from Task 1.
- Produces: a compatibility re-export from `src/cli.ts`, unchanged CLI output/exit semantics, and staged refresh leverage over the same imported function.
- Removes: all duplicate integrity types and implementation from `src/cli.ts` while retaining its private `countRows` for `stats` and `errorMessage` for `main`.

- [ ] **Step 1: Add failing CLI seam and adapter assertions**

In `tests/cli.test.ts`:

1. Replace the `appendFileSync` import with `readFileSync, rmSync`.
2. Remove the `readManifest` and `writeManifest` import.
3. Import the two function identities:

```ts
import { checkVault as cliCheckVault, runCli } from "../src/cli.js";
import { checkVault as moduleCheckVault } from "../src/vault-check.js";
```

4. Delete the two detailed tests named `check rejects a tampered source snapshot` and `check rejects an index whose document row disagrees with the manifest` because Task 1 now tests those outcomes at the deep interface.
5. Add these adapter-focused tests:

```ts
it("re-exports the deep VaultCheck function for source compatibility", () => {
  expect(cliCheckVault).toBe(moduleCheckVault);
});

it("preserves the human check output", async () => {
  fixture = createIndexFixture();
  buildIndex({ dataDir: fixture.root });

  const result = await runCli(["check", "--data", fixture.root]);

  expect(result).toEqual({
    stdout: "OK: 2 documents, 6 sections, 6 FTS rows, 2 source links.\n",
    stderr: "",
    exitCode: 0,
  });
});

it("maps a failed report to JSON exit code 1", async () => {
  fixture = createIndexFixture();
  buildIndex({ dataDir: fixture.root });
  rmSync(fixture.dbPath, { force: true });

  const result = await runCli(["check", "--json", "--data", fixture.root]);
  const report = JSON.parse(result.stdout) as { ok: boolean; errors: string[] };

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("");
  expect(report.ok).toBe(false);
  expect(report.errors[0]).toMatch(/^index: missing/);
});

it("preserves the human failure prefix", async () => {
  fixture = createIndexFixture();
  buildIndex({ dataDir: fixture.root });
  rmSync(fixture.dbPath, { force: true });

  await expect(runCli(["check", "--data", fixture.root])).rejects.toThrow(
    /^Vault check failed:\nindex: missing/,
  );
});
```

- [ ] **Step 2: Replace `tests/refresh.test.ts` with an explicit staged-check test**

Use this complete file so the test controls only the internal `VaultCheck` seam and uses loopback HTTP for a valid staged crawl:

```ts
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIndex } from "../src/index.js";
import { hashBytes } from "../src/manifest.js";
import type { CheckReport } from "../src/vault-check.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault | undefined;
let server: Server | undefined;

afterEach(async () => {
  if (server?.listening) {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
  server = undefined;
  fixture?.cleanup();
  fixture = undefined;
  vi.doUnmock("../src/vault-check.js");
  vi.resetModules();
});

function publishedDigests(vault: TestVault): Record<string, string> {
  return Object.fromEntries(
    [
      "manifest.json",
      "index/pi-docs.sqlite",
      "sources/extensions.html",
      "sources/extensions.md",
      "sources/using-pi.html",
      "sources/using-pi.md",
    ].map((relativePath) => [
      relativePath,
      hashBytes(readFileSync(path.join(vault.root, relativePath))),
    ]),
  );
}

async function startDocsServer(): Promise<string> {
  server = createServer((request, response) => {
    if (request.url === "/docs/latest") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html><head><title>Test Docs</title></head><body><main><h1>Test Docs</h1><p>Local refresh fixture.</p></main></body></html>",
      );
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP address");
  return `http://127.0.0.1:${address.port}/docs/latest`;
}

describe("staged refresh", () => {
  it("leaves the previously published manifest intact when crawl fails", async () => {
    fixture = createIndexFixture();
    const previousManifest = JSON.parse(
      readFileSync(`${fixture.root}/manifest.json`, "utf8"),
    ) as unknown;
    const unreachableUrl = "http://127.0.0.1:1/docs/latest";
    const { runCli } = await import("../src/cli.js");

    await expect(
      runCli(["refresh", "--base-url", unreachableUrl, "--data", fixture.root]),
    ).rejects.toThrow();

    expect(JSON.parse(readFileSync(`${fixture.root}/manifest.json`, "utf8"))).toEqual(
      previousManifest,
    );
  });

  it("removes failed staging and preserves every published byte when VaultCheck fails", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    const before = publishedDigests(fixture);
    const parent = path.dirname(fixture.root);
    const baseName = path.basename(fixture.root);
    const managedSiblingNames = () =>
      readdirSync(parent)
        .filter(
          (name) =>
            name.startsWith(`.${baseName}.staging-`) || name.startsWith(`.${baseName}.backup-`),
        )
        .sort();
    const siblingsBefore = managedSiblingNames();
    const failedCheck = vi.fn(
      (dataDir: string): CheckReport => ({
        ok: false,
        dataDir: path.resolve(dataDir).replaceAll("\\", "/"),
        documents: 1,
        sections: 1,
        ftsRows: 1,
        sourceLinks: 1,
        errors: ["forced staged integrity failure"],
      }),
    );
    vi.doMock("../src/vault-check.js", async () => {
      const actual = await vi.importActual<typeof import("../src/vault-check.js")>(
        "../src/vault-check.js",
      );
      return { ...actual, checkVault: failedCheck };
    });
    const { refreshDocs } = await import("../src/cli.js");
    const baseUrl = await startDocsServer();

    await expect(refreshDocs({ baseUrl, dataDir: fixture.root })).rejects.toThrow(
      "Staged vault failed integrity checks:\nforced staged integrity failure",
    );

    expect(failedCheck).toHaveBeenCalledTimes(1);
    expect(path.basename(failedCheck.mock.calls[0]?.[0] ?? "")).toMatch(
      new RegExp(`^\\.${baseName}\\.staging-`),
    );
    expect(publishedDigests(fixture)).toEqual(before);
    expect(managedSiblingNames()).toEqual(siblingsBefore);
  });
});
```

- [ ] **Step 3: Run the focused tests and confirm they expose the duplicate implementation**

Run: `npm run test -- tests/cli.test.ts tests/refresh.test.ts`

Expected: FAIL. The identity assertion must show that `src/cli.ts` still exports its own `checkVault`, and the forced staged report must not block refresh while refresh still calls that local copy.

- [ ] **Step 4: Rewire `src/cli.ts` and delete its integrity implementation**

Apply these import changes:

```ts
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { crawlDocs, type CrawlResult } from "./crawl.js";
import { sectionizeMarkdown } from "./extract.js";
import { buildIndex, resolveManifestPath } from "./index.js";
import { readManifest } from "./manifest.js";
import { checkVault, type CheckReport } from "./vault-check.js";

export { checkVault };
export type { CheckReport };
```

Keep the existing imports not shown above, including `DatabaseSync`, because `runStats` and benchmarks still use them.

Delete these declarations from `src/cli.ts`:

- the local `CheckReport` interface;
- `ExpectedDocument`, `IndexedDocumentRow`, `IndexedSectionRow`, and `IndexedDocumentField`;
- the local `checkVault` function;
- `validateManifestEntry`, `validateIndexedDocuments`, and `validateIndexedSections`;
- `resolveVerifiedPath` and `realpathForCheck`.

Retain the private `countRows` function because `runStats` calls it. Retain the private `errorMessage` function because `main` calls it. Do not change `refreshDocs`, `runCheck`, their output strings, or their error strings; their existing calls now resolve to the imported function.

- [ ] **Step 5: Run the shared-seam and regression tests**

Run:

```text
npm run test -- tests/vault-check.test.ts tests/cli.test.ts tests/refresh.test.ts tests/index.test.ts
```

Expected: PASS. The compatibility identity is exact, forced staged failure leaves all published digests unchanged, and detailed integrity behavior remains green only at the deep interface.

Run: `npm run typecheck`

Expected: PASS with no unused imports, missing types, or source-compatibility errors.

Run: `npm run lint`

Expected: PASS with exit code 0.

- [ ] **Step 6: Inspect the resulting implementation surface**

Run:

```text
rg -n "validateManifestEntry|validateIndexedDocuments|validateIndexedSections|resolveVerifiedPath|realpathForCheck|PRAGMA integrity_check|FTS row mismatch" src/cli.ts src/vault-check.ts
```

Expected: every integrity declaration and integrity-specific string appears only in `src/vault-check.ts`. `src/cli.ts` may contain only `checkVault` import/re-export/call sites.

- [ ] **Step 7: Commit the caller migration**

```text
git add src/cli.ts tests/cli.test.ts tests/refresh.test.ts
git commit -m "refactor: route vault checks through one seam"
```

---

### Task 3: Include `VaultCheck` in every portable runtime

**Files:**

- Modify: `src/install-plan.ts:25-53`
- Modify: `scripts/install-pi-integration.ps1:298-321`
- Modify: `tests/installer.test.ts`

**Interfaces:**

- Consumes: the new runtime source file `src/vault-check.ts`.
- Produces: `portable/src/vault-check.ts` in both the pure install plan and the PowerShell installer output.
- Preserves: the machine-managed file list and all auth/session/provider exclusions.

- [ ] **Step 1: Add failing plan and materialized-output assertions**

In the first `planInstall` test, add:

```ts
expect(plan.writes).toContain(path.join(portableOutput, "src", "vault-check.ts"));
```

Add `readFileSync` to the `node:fs` imports and add this test to `tests/installer.test.ts`:

```ts
it("copies VaultCheck into the portable CLI runtime", () => {
  if (process.platform !== "win32") return;

  const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-portable-check-"));
  roots.push(root);
  const piAgentDir = path.join(root, "pi-agent");
  const portableOutput = path.join(root, "portable");
  const scriptPath = fileURLToPath(
    new URL("../scripts/install-pi-integration.ps1", import.meta.url),
  );
  const vaultRoot = fileURLToPath(new URL("../data", import.meta.url));

  const result = spawnSync(
    "pwsh",
    [
      "-NoProfile",
      "-File",
      scriptPath,
      "-VaultRoot",
      vaultRoot,
      "-PiAgentDir",
      piAgentDir,
      "-PortableOutput",
      portableOutput,
    ],
    { encoding: "utf8", windowsHide: true },
  );

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  const portableCheckPath = path.join(portableOutput, "src", "vault-check.ts");
  expect(existsSync(portableCheckPath)).toBe(true);
  expect(readFileSync(portableCheckPath, "utf8")).toContain(
    "export function checkVault(dataDir: string): CheckReport",
  );
});
```

- [ ] **Step 2: Run the installer tests and confirm both omissions**

Run: `npm run test -- tests/installer.test.ts`

Expected: FAIL because neither `planInstall` nor `$portableFiles` currently includes `src/vault-check.ts`. Existing safety tests must remain green.

- [ ] **Step 3: Add the file to both portable source lists**

In `src/install-plan.ts`, add this item immediately after portable `src/cli.ts`:

```ts
path.join(portableOutput, "src", "vault-check.ts"),
```

In `$portableFiles` in `scripts/install-pi-integration.ps1`, add this item immediately after portable `src\cli.ts`:

```powershell
@{ Source = (Join-Path $projectRoot "src\vault-check.ts"); Destination = (Join-Path $portable "src\vault-check.ts") },
```

Do not add the file to `$machineFiles` or `Get-ManagedMachinePaths`; the installed Pi extension does not import it.

- [ ] **Step 4: Run installer, plan, and safety regression tests**

Run: `npm run test -- tests/installer.test.ts`

Expected: PASS, including the actual temporary PowerShell install and the existing reparse/uninstall safety cases.

Run: `npm run typecheck`

Expected: PASS.

Run: `git diff --check`

Expected: no whitespace errors, including in the PowerShell source list.

- [ ] **Step 5: Commit portable packaging**

```text
git add src/install-plan.ts scripts/install-pi-integration.ps1 tests/installer.test.ts
git commit -m "fix: package vault check module"
```

---

### Task 4: Validate the complete change and update durable evidence

**Files:**

- Modify: `docs/superpowers/specs/2026-09-12-pi-agent-vault-design.md:59-75`
- Modify: `docs/operations.md:24-30`
- Modify: `docs/validation-report.md`
- Regenerate outside Git: `C:/Users/littl/Documents/Codex/2026-09-12/pi/outputs/pi-agent-vault`

**Interfaces:**

- Consumes: all implementation and test results from Tasks 1-3.
- Produces: repeatable acceptance evidence, an updated portable handoff, and documentation matching the actual repository.
- Does not modify: `data/**` or the machine-installed Pi extension.

- [ ] **Step 1: Run the affected regression set and full quality gate**

Run:

```text
npm run test -- tests/vault-check.test.ts tests/cli.test.ts tests/refresh.test.ts tests/installer.test.ts tests/index.test.ts
npm run check
```

Expected: both commands exit zero. Record the exact Vitest file and test counts printed by `npm run check` for the validation report.

- [ ] **Step 2: Verify the live corpus and tracked data invariance**

Run:

```text
npx tsx src/cli.ts check --json --data C:/Users/littl/Documents/Codex/2026-09-12/pi/work/pi-agent-vault/data
git diff --exit-code c2d2298 -- data
```

Expected JSON fields:

```json
{
  "ok": true,
  "documents": 30,
  "sections": 663,
  "ftsRows": 663,
  "sourceLinks": 30,
  "errors": []
}
```

The JSON also contains the normalized absolute `dataDir`. The Git command must produce no diff and exit zero.

- [ ] **Step 3: Measure the three-batch warm performance gate**

Run this read-only measurement from the repository root:

```powershell
@'
import path from "node:path";
import { performance } from "node:perf_hooks";
import { checkVault } from "./src/vault-check.ts";

const dataDir = path.resolve("data");
const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
};

checkVault(dataDir);
const batches = [];
for (let batch = 0; batch < 3; batch += 1) {
  checkVault(dataDir);
  const samples = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const start = performance.now();
    const report = checkVault(dataDir);
    if (!report.ok) throw new Error(report.errors.join("\n"));
    samples.push(performance.now() - start);
  }
  batches.push({
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  });
}

const medianOfMediansMs = percentile(
  batches.map((batch) => batch.medianMs),
  0.5,
);
const medianP95Ms = percentile(
  batches.map((batch) => batch.p95Ms),
  0.5,
);
const result = {
  batches,
  medianOfMediansMs,
  medianP95Ms,
  limits: { medianMs: 22.08, p95Ms: 24.86 },
  pass: medianOfMediansMs <= 22.08 && medianP95Ms <= 24.86,
};
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
'@ | node --import=tsx/esm -
```

Expected: `pass` is `true` and the process exits zero. If it fails, stop acceptance, rerun one unchanged batch only to rule out an identified transient load, then inspect for added I/O or SQL before changing the limits.

- [ ] **Step 4: Prove a fresh temporary portable runtime**

Run this PowerShell block. It confines temporary installation and recursive cleanup to a newly created directory below the operating-system temp root:

```powershell
$ErrorActionPreference = "Stop"
$vaultCheckRepoRoot = (Resolve-Path -LiteralPath ".").Path
$vaultCheckTempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$vaultCheckValidationRoot = Join-Path $vaultCheckTempBase ("pi-vault-check-validation-" + [Guid]::NewGuid().ToString("N"))
$vaultCheckValidationRoot = [IO.Path]::GetFullPath($vaultCheckValidationRoot)
$vaultCheckTempPrefix = "$vaultCheckTempBase$([IO.Path]::DirectorySeparatorChar)"
if (-not $vaultCheckValidationRoot.StartsWith($vaultCheckTempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Temporary validation root escaped the OS temp directory: $vaultCheckValidationRoot"
}
New-Item -ItemType Directory -Path $vaultCheckValidationRoot | Out-Null

try {
  $vaultCheckScript = Join-Path $vaultCheckRepoRoot "scripts\install-pi-integration.ps1"
  $vaultCheckData = Join-Path $vaultCheckRepoRoot "data"
  $vaultCheckTempPi = Join-Path $vaultCheckValidationRoot "pi-agent"
  $vaultCheckTempPortable = Join-Path $vaultCheckValidationRoot "portable"
  pwsh -NoProfile -File $vaultCheckScript -VaultRoot $vaultCheckData -PiAgentDir $vaultCheckTempPi -PortableOutput $vaultCheckTempPortable
  if ($LASTEXITCODE -ne 0) { throw "Temporary portable install failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath (Join-Path $vaultCheckTempPortable "src\vault-check.ts") -PathType Leaf)) {
    throw "Temporary portable output omitted src\vault-check.ts"
  }

  Push-Location $vaultCheckTempPortable
  try {
    npm ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "Portable npm ci failed with exit code $LASTEXITCODE" }
    $vaultCheckJsonLines = & .\pi-docs.cmd check --json
    if ($LASTEXITCODE -ne 0) { throw "Portable check failed with exit code $LASTEXITCODE" }
    $vaultCheckReport = ($vaultCheckJsonLines -join [Environment]::NewLine) | ConvertFrom-Json
    if (-not $vaultCheckReport.ok -or $vaultCheckReport.documents -ne 30 -or $vaultCheckReport.sections -ne 663 -or $vaultCheckReport.ftsRows -ne 663 -or $vaultCheckReport.sourceLinks -ne 30) {
      throw "Portable check returned an unexpected report"
    }
  } finally {
    Pop-Location
  }

} finally {
  if (Test-Path -LiteralPath $vaultCheckValidationRoot) {
    $vaultCheckResolvedCleanup = [IO.Path]::GetFullPath($vaultCheckValidationRoot)
    if (-not $vaultCheckResolvedCleanup.StartsWith($vaultCheckTempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing recursive cleanup outside OS temp: $vaultCheckResolvedCleanup"
    }
    Remove-Item -LiteralPath $vaultCheckResolvedCleanup -Recurse -Force
  }
}
```

Expected: temporary install, `npm ci`, and portable check all succeed. No machine Pi resource directory is touched because `PiAgentDir` is temporary. The approved handoff is regenerated only after its copied documentation is final in Step 8.

- [ ] **Step 5: Update architecture and operations documentation**

In the repository tree shown in `docs/superpowers/specs/2026-09-12-pi-agent-vault-design.md`, add:

```text
│   ├── vault-check.ts
```

immediately after `cli.ts`, and add:

```text
│   ├── vault-check.test.ts
```

to the test list.

After the offline-command sentence in `docs/operations.md`, add this exact paragraph:

```markdown
The explicit `check` command and the pre-publication stage of `refresh` use the same `VaultCheck` module. It opens the local SQLite index read-only and reconciles the manifest, source hashes, paths, derived sections, and FTS relationships before a staged vault can be published.
```

- [ ] **Step 6: Record exact validation evidence**

In `docs/validation-report.md`:

1. Replace the existing `npm run check` file/test counts with the exact final Vitest summary from Step 1.
2. Add a `## VaultCheck deep module` section that records:
   - the two-name TypeScript interface and single runtime export;
   - the passing direct interface, CLI adapter, staged refresh, and installer test files;
   - the unchanged live `30 / 663 / 663 / 30` report;
   - the pre-change median 20.07 ms and p95 21.62 ms;
   - every post-change batch measurement and the calculated median-of-medians/p95 values emitted by Step 3;
   - whether both 22.08 ms and 24.86 ms limits passed; and
   - the successful fresh portable check and approved output regeneration.

Copy measured values exactly from command output; do not estimate or silently round a failing result into compliance.

Treat the statement about approved handoff regeneration as provisional until Step 8 succeeds. If that step fails, do not commit a passing claim.

- [ ] **Step 7: Re-run documentation and repository gates**

Run:

```text
npx prettier --check docs/superpowers/specs/2026-09-12-pi-agent-vault-design.md docs/operations.md docs/validation-report.md
git diff --check
npm run check
git diff --exit-code c2d2298 -- data
```

Expected: every command exits zero. Do not refresh or rebuild `data/` to make this gate pass.

- [ ] **Step 8: Regenerate the approved handoff from the final documented tree**

Run this PowerShell block after Step 7 has passed. It uses a temporary `PiAgentDir`, updates only the approved portable output, and verifies that the new runtime source is present:

```powershell
$ErrorActionPreference = "Stop"
$vaultCheckRepoRoot = (Resolve-Path -LiteralPath ".").Path
$vaultCheckTempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$vaultCheckHandoffRoot = Join-Path $vaultCheckTempBase ("pi-vault-check-handoff-" + [Guid]::NewGuid().ToString("N"))
$vaultCheckHandoffRoot = [IO.Path]::GetFullPath($vaultCheckHandoffRoot)
$vaultCheckTempPrefix = "$vaultCheckTempBase$([IO.Path]::DirectorySeparatorChar)"
if (-not $vaultCheckHandoffRoot.StartsWith($vaultCheckTempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Temporary handoff root escaped the OS temp directory: $vaultCheckHandoffRoot"
}
New-Item -ItemType Directory -Path $vaultCheckHandoffRoot | Out-Null

try {
  $vaultCheckScript = Join-Path $vaultCheckRepoRoot "scripts\install-pi-integration.ps1"
  $vaultCheckData = Join-Path $vaultCheckRepoRoot "data"
  $vaultCheckTemporaryPi = Join-Path $vaultCheckHandoffRoot "pi-agent"
  $vaultCheckOfficialOutput = [IO.Path]::GetFullPath(
    (Join-Path $vaultCheckRepoRoot "..\..\outputs\pi-agent-vault")
  )
  pwsh -NoProfile -File $vaultCheckScript -VaultRoot $vaultCheckData -PiAgentDir $vaultCheckTemporaryPi -PortableOutput $vaultCheckOfficialOutput
  if ($LASTEXITCODE -ne 0) { throw "Approved handoff regeneration failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath (Join-Path $vaultCheckOfficialOutput "src\vault-check.ts") -PathType Leaf)) {
    throw "Approved handoff omitted src\vault-check.ts"
  }
  $vaultCheckRepoValidationHash = (Get-FileHash -LiteralPath (Join-Path $vaultCheckRepoRoot "docs\validation-report.md") -Algorithm SHA256).Hash
  $vaultCheckOutputValidationHash = (Get-FileHash -LiteralPath (Join-Path $vaultCheckOfficialOutput "docs\validation-report.md") -Algorithm SHA256).Hash
  if ($vaultCheckRepoValidationHash -ne $vaultCheckOutputValidationHash) {
    throw "Approved handoff contains a stale validation report"
  }
} finally {
  if (Test-Path -LiteralPath $vaultCheckHandoffRoot) {
    $vaultCheckResolvedCleanup = [IO.Path]::GetFullPath($vaultCheckHandoffRoot)
    if (-not $vaultCheckResolvedCleanup.StartsWith($vaultCheckTempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing recursive cleanup outside OS temp: $vaultCheckResolvedCleanup"
    }
    Remove-Item -LiteralPath $vaultCheckResolvedCleanup -Recurse -Force
  }
}
```

Expected: the approved output contains `src/vault-check.ts` and a byte-identical copy of the final `docs/validation-report.md`. The actual user Pi resource directory remains untouched.

- [ ] **Step 9: Commit documentation and validation evidence**

```text
git add docs/superpowers/specs/2026-09-12-pi-agent-vault-design.md docs/operations.md docs/validation-report.md
git commit -m "docs: record vault check validation"
```

---

### Task 5: Obtain independent review and close the acceptance gate

**Files:**

- Review: every change after baseline commit `c2d2298`
- Re-check: `docs/superpowers/specs/2026-09-12-vault-check-module-design.md`
- Modify only if a finding requires it: the smallest affected source, test, or documentation file

**Interfaces:**

- Consumes: the complete implementation, tests, packaging, and validation evidence.
- Produces: an independent review with no unresolved in-scope findings and final evidence that remains valid after any repair.

- [ ] **Step 1: Inspect the final diff before dispatching review**

Run:

```text
git status --short
git log --oneline c2d2298..HEAD
git diff --stat c2d2298..HEAD
git diff --check c2d2298..HEAD
```

Expected: the worktree is clean, the four planned implementation/documentation commits are present, and the diff check exits zero.

- [ ] **Step 2: Request one fresh independent code review**

Use a fresh reviewer that did not implement Tasks 1-4. Give it this exact review request:

```text
Review the changes from c2d2298 through HEAD against docs/superpowers/specs/2026-09-12-vault-check-module-design.md. Do not modify files. Check both correctness and architecture: the VaultCheck interface must stay small; all integrity policy and SQLite handling must be local to src/vault-check.ts; src/cli.ts must be only the CLI/refresh adapter while preserving its compatibility re-export; check behavior, error order, read-only properties, staged publication safety, test quality, and portable packaging must match the spec. Look specifically for cyclic dependencies, leaked internal helpers, missing corruption cases, filesystem escape regressions, SQLite connections not closed on errors, mocks that widen production interfaces, missing installer source files, corpus changes, and unsupported completion claims. Report findings in severity order with file and line evidence. If there are no findings, state that explicitly and list residual risks.
```

Expected: a written review containing either evidence-backed findings or an explicit no-findings result. Do not treat tests alone as the independent review.

- [ ] **Step 3: Resolve every in-scope finding before completion**

For each finding, verify it against the approved spec. If valid, first add or adjust the smallest failing test that reproduces it, run that focused test to confirm failure, implement the smallest correction, and rerun the failed plus transitively affected checks. Commit valid repairs together:

Stage each file changed for a validated finding by its explicit literal path with `git add --`, then inspect `git diff --cached --name-only` and commit only that reviewed set:

```text
git commit -m "fix: resolve vault check review findings"
```

If the first review has no findings, make no empty commit. If a repair changes runtime behavior, performance-sensitive I/O, packaging, test counts, or reported evidence, update `docs/validation-report.md`, rerun the invalidated acceptance step, and include the documentation in the repair commit. Ask the independent reviewer to re-check substantive repairs; unresolved findings block completion.

- [ ] **Step 4: Run the final proportional verification**

Run:

```text
npm run check
npx tsx src/cli.ts check --json --data C:/Users/littl/Documents/Codex/2026-09-12/pi/work/pi-agent-vault/data
git diff --exit-code c2d2298 -- data
git status --short
```

Expected: the quality gate exits zero; the live report is exactly `ok=true`, `documents=30`, `sections=663`, `ftsRows=663`, `sourceLinks=30`, and `errors=[]`; tracked data has no diff; and the worktree is clean.

Verify the approved handoff file exists:

```powershell
Test-Path -LiteralPath "C:\Users\littl\Documents\Codex\2026-09-12\pi\outputs\pi-agent-vault\src\vault-check.ts" -PathType Leaf
```

Expected: `True`.

- [ ] **Step 5: Report completion against the acceptance criteria**

The completion report must name:

- the new deep module and its two-name TypeScript interface;
- the CLI and refresh callers now sharing one seam;
- targeted and full test results;
- live corpus counts and unchanged-data evidence;
- pre/post warm performance values and pass/fail thresholds;
- portable runtime validation and output location;
- independent review result and any repair commit; and
- remaining uncertainty, including performance sensitivity to unrelated machine load.

Do not claim completion while any acceptance criterion or independent finding remains unresolved.
