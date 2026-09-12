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

export function checkVault(dataDir: string): CheckReport {
  const paths = resolveVaultPaths(path.resolve(dataDir));
  const errors: string[] = [];
  let documents = 0;
  let sections = 0;
  let ftsRows = 0;
  let sourceLinks = 0;
  let manifest: Manifest | undefined;
  let baseUrl: URL | undefined;
  const expectedDocuments = new Map<string, ExpectedDocument>();
  const manifestUrls = new Map<string, string>();

  try {
    manifest = readManifest(paths.manifestPath);
    documents = manifest.entries.length;
  } catch (error) {
    errors.push(`manifest: ${errorMessage(error)}`);
  }

  if (manifest) {
    try {
      baseUrl = new URL(manifest.rootUrl);
    } catch {
      errors.push(`manifest rootUrl is not a valid URL: ${manifest.rootUrl}`);
    }

    for (const [index, entry] of manifest.entries.entries()) {
      try {
        const expectedSections = validateManifestEntry(entry, index, baseUrl, paths.root);
        if (expectedDocuments.has(entry.id)) {
          throw new Error(`duplicate document id: ${entry.id}`);
        }
        const previousId = manifestUrls.get(entry.url);
        if (previousId) {
          throw new Error(`duplicate document URL: ${entry.url} (also used by ${previousId})`);
        }
        expectedDocuments.set(entry.id, { entry, sections: expectedSections });
        manifestUrls.set(entry.url, entry.id);
        sourceLinks += 1;
      } catch (error) {
        errors.push(`entry ${index}: ${errorMessage(error)}`);
      }
    }
  }

  if (!existsSync(paths.indexPath)) {
    errors.push(`index: missing ${paths.indexPath}`);
  } else {
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(paths.indexPath, { readOnly: true });
      const integrityRow = db.prepare("PRAGMA integrity_check").get() as {
        integrity_check?: unknown;
      };
      if (integrityRow.integrity_check !== "ok") {
        errors.push(`index: integrity_check returned ${String(integrityRow.integrity_check)}`);
      }

      documents = countRows(db, "documents");
      sections = countRows(db, "sections");
      ftsRows = countRows(db, "sections_fts");
      const missingFts = countRows(
        db,
        "SELECT COUNT(*) AS count FROM sections AS s LEFT JOIN sections_fts AS f ON f.rowid = s.id WHERE f.rowid IS NULL",
      );
      const orphanFts = countRows(
        db,
        "SELECT COUNT(*) AS count FROM sections_fts AS f LEFT JOIN sections AS s ON s.id = f.rowid WHERE s.id IS NULL",
      );
      if (missingFts > 0 || orphanFts > 0) {
        errors.push(`index: FTS row mismatch (missing=${missingFts}, orphan=${orphanFts})`);
      }
      if (manifest) {
        validateIndexedDocuments(db, expectedDocuments, errors);
        validateIndexedSections(db, expectedDocuments, errors);
      }
    } catch (error) {
      errors.push(`index: ${errorMessage(error)}`);
    } finally {
      db?.close();
    }
  }

  if (manifest && documents !== manifest.entries.length) {
    errors.push(
      `index: document count ${documents} does not match manifest count ${manifest.entries.length}`,
    );
  }

  return {
    ok: errors.length === 0,
    dataDir: paths.root,
    documents,
    sections,
    ftsRows,
    sourceLinks,
    errors,
  };
}

function validateManifestEntry(
  entry: ManifestEntry,
  index: number,
  baseUrl: URL | undefined,
  root: string,
): ExtractedSection[] {
  if (
    !entry ||
    typeof entry.id !== "string" ||
    typeof entry.url !== "string" ||
    typeof entry.title !== "string" ||
    typeof entry.sha256 !== "string" ||
    typeof entry.contentHash !== "string" ||
    typeof entry.htmlPath !== "string" ||
    typeof entry.markdownPath !== "string"
  ) {
    throw new Error("invalid manifest entry fields");
  }
  if (!baseUrl) throw new Error("cannot validate source link without a valid manifest rootUrl");
  const canonical = canonicalizeDocsUrl(entry.url, baseUrl);
  if (!canonical || canonical.href !== entry.url) {
    throw new Error(`URL is outside scope or not canonical: ${entry.url}`);
  }
  const htmlPath = resolveVerifiedPath(root, entry.htmlPath);
  const markdownPath = resolveVerifiedPath(root, entry.markdownPath);
  const html = readFileSync(htmlPath);
  const markdown = readFileSync(markdownPath, "utf8");
  if (hashBytes(html) !== entry.sha256) throw new Error(`HTML SHA-256 mismatch for ${entry.url}`);
  if (hashBytes(new TextEncoder().encode(markdown)) !== entry.contentHash) {
    throw new Error(`Markdown content hash mismatch for ${entry.url}`);
  }
  if (!entry.url.includes("/docs/latest"))
    throw new Error(`source link is not a latest-doc URL: ${entry.url}`);
  if (index < 0) throw new Error("invalid manifest entry index");
  return sectionizeMarkdown(markdown, entry.title);
}

function validateIndexedDocuments(
  db: DatabaseSync,
  expectedDocuments: Map<string, ExpectedDocument>,
  errors: string[],
): void {
  const rows = db
    .prepare(
      "SELECT id, url, title, html_path, markdown_path, sha256, content_hash FROM documents ORDER BY id",
    )
    .all() as IndexedDocumentRow[];
  const seen = new Set<string>();
  const fields: IndexedDocumentField[] = [
    "id",
    "url",
    "title",
    "htmlPath",
    "markdownPath",
    "sha256",
    "contentHash",
  ];
  const columnByField: Record<IndexedDocumentField, keyof IndexedDocumentRow> = {
    id: "id",
    url: "url",
    title: "title",
    htmlPath: "html_path",
    markdownPath: "markdown_path",
    sha256: "sha256",
    contentHash: "content_hash",
  };

  for (const row of rows) {
    if (typeof row.id !== "string") {
      errors.push("index: document row has a non-string id");
      continue;
    }
    seen.add(row.id);
    const expected = expectedDocuments.get(row.id);
    if (!expected) {
      errors.push(`index: orphan document row ${row.id}`);
      continue;
    }
    for (const field of fields) {
      const actual = row[columnByField[field]];
      if (actual !== expected.entry[field]) {
        errors.push(
          `index: document mismatch for ${row.id}: ${field} differs between manifest and SQLite`,
        );
      }
    }
  }

  for (const id of expectedDocuments.keys()) {
    if (!seen.has(id)) errors.push(`index: manifest document ${id} is missing from SQLite`);
  }
}

function validateIndexedSections(
  db: DatabaseSync,
  expectedDocuments: Map<string, ExpectedDocument>,
  errors: string[],
): void {
  const rows = db
    .prepare(
      "SELECT doc_id, ordinal, heading_path, title, body FROM sections ORDER BY doc_id, ordinal",
    )
    .all() as IndexedSectionRow[];
  const actualByDocument = new Map<string, IndexedSectionRow[]>();
  const expectedSectionCount = [...expectedDocuments.values()].reduce(
    (total, document) => total + document.sections.length,
    0,
  );
  if (rows.length !== expectedSectionCount) {
    errors.push(
      `index: total section count mismatch (manifest=${expectedSectionCount}, SQLite=${rows.length})`,
    );
  }

  for (const row of rows) {
    if (typeof row.doc_id !== "string") {
      errors.push("index: section row has a non-string document id");
      continue;
    }
    const documentRows = actualByDocument.get(row.doc_id) ?? [];
    documentRows.push(row);
    actualByDocument.set(row.doc_id, documentRows);
  }

  for (const [id, expected] of expectedDocuments) {
    const actual = actualByDocument.get(id) ?? [];
    if (actual.length !== expected.sections.length) {
      errors.push(
        `index: section count mismatch for ${id} (manifest=${expected.sections.length}, SQLite=${actual.length})`,
      );
    }
    for (let index = 0; index < Math.max(actual.length, expected.sections.length); index += 1) {
      const actualSection = actual[index];
      const expectedSection = expected.sections[index];
      if (!actualSection || !expectedSection) continue;
      const expectedHeadingPath = expectedSection.headingPath.join(" / ");
      if (
        Number(actualSection.ordinal) !== expectedSection.ordinal ||
        actualSection.heading_path !== expectedHeadingPath ||
        actualSection.title !== expectedSection.title ||
        actualSection.body !== expectedSection.body
      ) {
        errors.push(`index: section mismatch for ${id} at ordinal ${expectedSection.ordinal}`);
      }
    }
  }

  for (const id of actualByDocument.keys()) {
    if (!expectedDocuments.has(id)) errors.push(`index: orphan sections for document ${id}`);
  }
}

function resolveVerifiedPath(root: string, relativePath: string): string {
  const resolved = resolveManifestPath(root, relativePath);
  const rootReal = realpathForCheck(root);
  const fileReal = realpathForCheck(resolved);
  const relative = path.relative(rootReal, fileReal);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path resolves outside vault: ${relativePath}`);
  }
  return resolved;
}

function realpathForCheck(target: string): string {
  return path.resolve(realpathSync.native(target));
}

function countRows(db: DatabaseSync, tableOrQuery: string): number {
  const query = tableOrQuery.includes(" ")
    ? tableOrQuery
    : `SELECT COUNT(*) AS count FROM ${tableOrQuery}`;
  const row = db.prepare(query).get() as { count?: number | bigint };
  return Number(row.count ?? 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
