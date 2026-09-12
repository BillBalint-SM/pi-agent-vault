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
import { hashBytes, readManifest, writeManifest, type Manifest } from "../src/manifest.js";
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
    expect(checkVault(vault.root).errors.some((error) => expected.test(error))).toBe(true);
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
        db.prepare(
          "INSERT INTO sections (doc_id, ordinal, heading_path, title, body) VALUES (?, ?, ?, ?, ?)",
        ).run("orphan", 0, "Orphan", "Orphan", "Orphan body");
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
    expect(checkVault(vault.root).errors.slice(0, 2)).toEqual([
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
