import { DatabaseSync } from "node:sqlite";

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

export interface ReadonlySearchIndex {
  search(query: string, options?: SearchOptions): SearchResult[];
  close(): void;
}

interface SearchRow {
  doc_id: string;
  title: string;
  heading_path: string;
  snippet: string;
  score: number;
  url: string;
  source_path: string;
  sha256: string;
  ordinal: number;
}

export function searchDocs(
  dbPath: string,
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const matchQuery = createMatchQuery(query);
  if (!matchQuery) return [];

  const limit = clampLimit(options.limit);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return searchWithDatabase(db, matchQuery, limit);
  } finally {
    db.close();
  }
}

export function openSearchIndex(dbPath: string): ReadonlySearchIndex {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  let closed = false;
  return {
    search(query, options = {}) {
      if (closed) throw new Error("Search index is closed");
      const matchQuery = createMatchQuery(query);
      if (!matchQuery) return [];
      return searchWithDatabase(db, matchQuery, clampLimit(options.limit));
    },
    close() {
      if (!closed) {
        closed = true;
        db.close();
      }
    },
  };
}

function searchWithDatabase(db: DatabaseSync, matchQuery: string, limit: number): SearchResult[] {
  const rows = db
    .prepare(
      `
      SELECT
        d.id AS doc_id,
        d.title AS title,
        s.heading_path AS heading_path,
        s.ordinal AS ordinal,
        snippet(sections_fts, 2, '<mark>', '</mark>', ' … ', 32) AS snippet,
        bm25(sections_fts, 5.0, 3.0, 1.0) AS score,
        d.url AS url,
        d.markdown_path AS source_path,
        d.sha256 AS sha256
      FROM sections_fts
      JOIN sections AS s ON s.id = sections_fts.rowid
      JOIN documents AS d ON d.id = s.doc_id
      WHERE sections_fts MATCH ?
      ORDER BY score ASC, d.url ASC, s.ordinal ASC
      LIMIT ?
    `,
    )
    .all(matchQuery, limit) as unknown as SearchRow[];

  return rows.map((row) => ({
    docId: row.doc_id,
    title: row.title,
    headingPath: row.heading_path ? row.heading_path.split(" / ") : [],
    snippet: row.snippet.slice(0, 1200),
    score: row.score,
    url: row.url,
    sourcePath: row.source_path,
    sha256: row.sha256,
  }));
}

function createMatchQuery(query: string): string {
  const tokens = query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return tokens
    .slice(0, 32)
    .map((token) => `"${token.replaceAll('"', '""')}"`)
    .join(" AND ");
}

function clampLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}
