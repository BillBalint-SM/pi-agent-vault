import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { readManifest } from "./manifest.js";
import { sectionizeMarkdown } from "./extract.js";
import { resolveVaultPaths } from "./paths.js";

export interface BuildIndexOptions {
  dataDir: string;
  dbPath?: string;
}

export interface BuildIndexResult {
  dbPath: string;
  documentCount: number;
  sectionCount: number;
}

export function buildIndex(options: BuildIndexOptions): BuildIndexResult {
  const paths = resolveVaultPaths(options.dataDir);
  const dbPath = options.dbPath ? path.resolve(options.dbPath) : paths.indexPath;
  assertWithin(paths.root, dbPath);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });

  const manifest = readManifest(paths.manifestPath);
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
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
    `);

    db.exec("BEGIN IMMEDIATE");
    try {
      const insertDocument = db.prepare(`
        INSERT INTO documents (id, url, title, html_path, markdown_path, sha256, content_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSection = db.prepare(`
        INSERT INTO sections (doc_id, ordinal, heading_path, title, body)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertSearchRow = db.prepare(`
        INSERT INTO sections_fts (rowid, title, heading_path, body)
        VALUES (?, ?, ?, ?)
      `);

      let sectionCount = 0;
      for (const entry of manifest.entries) {
        insertDocument.run(
          entry.id,
          entry.url,
          entry.title,
          entry.htmlPath,
          entry.markdownPath,
          entry.sha256,
          entry.contentHash,
        );
        const markdownPath = resolveManifestPath(paths.root, entry.markdownPath);
        const markdown = readFileSync(markdownPath, "utf8");
        for (const section of sectionizeMarkdown(markdown, entry.title)) {
          const inserted = insertSection.run(
            entry.id,
            section.ordinal,
            section.headingPath.join(" / "),
            section.title,
            section.body,
          );
          const rowid = Number(inserted.lastInsertRowid);
          insertSearchRow.run(rowid, section.title, section.headingPath.join(" / "), section.body);
          sectionCount += 1;
        }
      }

      db.exec("INSERT INTO sections_fts(sections_fts) VALUES ('optimize')");
      db.exec("COMMIT");
      db.exec("PRAGMA optimize");
      return { dbPath, documentCount: manifest.entries.length, sectionCount };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

export function resolveManifestPath(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error(`Manifest path must be relative: ${relativePath}`);
  }
  const resolved = path.resolve(root, relativePath);
  assertWithin(root, resolved);
  return resolved;
}

function assertWithin(root: string, target: string): void {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  const relative = path.relative(normalizedRoot, normalizedTarget);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes vault root: ${target}`);
  }
}
