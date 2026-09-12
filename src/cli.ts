import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import { canonicalizeDocsUrl, crawlDocs, type CrawlResult } from "./crawl.js";
import { sectionizeMarkdown } from "./extract.js";
import { buildIndex, resolveManifestPath } from "./index.js";
import { hashBytes, readManifest, type Manifest, type ManifestEntry } from "./manifest.js";
import { resolveVaultPaths } from "./paths.js";
import { openSearchIndex, searchDocs, type SearchResult } from "./search.js";

export const DEFAULT_BASE_URL = "https://pi.dev/docs/latest";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CheckReport {
  ok: boolean;
  dataDir: string;
  documents: number;
  sections: number;
  ftsRows: number;
  sourceLinks: number;
  errors: string[];
}

export interface RefreshOptions {
  baseUrl: string;
  dataDir: string;
  concurrency?: number;
  timeoutMs?: number;
}

export interface RefreshSummary {
  dataDir: string;
  documentCount: number;
  sectionCount: number;
  report: CrawlResult["report"];
  check: CheckReport;
  backupDir?: string;
}

export interface BenchmarkReport {
  dataDir: string;
  iterations: number;
  queries: string[];
  coldProcessMs: PercentileReport;
  warmProcessMs: PercentileReport;
}

export interface PercentileReport {
  count: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

export const BENCHMARK_QUERIES = [
  "project trust",
  "defaultTools powershell",
  "Type.Object registerTool",
  "pi install package",
  "RPC mode stdin stdout",
  "session format JSONL",
  "containerization Docker",
  "provider API key",
];

type Command =
  "crawl" | "build-index" | "refresh" | "search" | "show" | "stats" | "benchmark" | "check";

interface ParsedArgs {
  command?: string;
  positionals: string[];
  data?: string;
  out?: string;
  baseUrl?: string;
  limit?: number;
  iterations?: number;
  concurrency?: number;
  timeoutMs?: number;
  section?: string;
  json: boolean;
  help: boolean;
}

export class CliUsageError extends Error {
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { positionals: [], json: false, help: false };
  const valueFlags = new Set([
    "--data",
    "--out",
    "--base-url",
    "--limit",
    "--iterations",
    "--concurrency",
    "--timeout-ms",
    "--section",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (token === "--") {
      parsed.positionals.push(...argv.slice(index + 1));
      break;
    }
    if (token === "--json") {
      parsed.json = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }
    if (token.startsWith("--")) {
      const equalsIndex = token.indexOf("=");
      const flag = equalsIndex >= 0 ? token.slice(0, equalsIndex) : token;
      if (!valueFlags.has(flag)) throw new CliUsageError(`Unknown option: ${flag}`);
      const inlineValue = equalsIndex >= 0 ? token.slice(equalsIndex + 1) : undefined;
      const value = inlineValue ?? argv[++index];
      if (!value || value.startsWith("--"))
        throw new CliUsageError(`Option requires a value: ${flag}`);
      assignValue(parsed, flag, value);
      continue;
    }
    if (token.startsWith("-")) throw new CliUsageError(`Unknown option: ${token}`);
    if (!parsed.command) parsed.command = token;
    else parsed.positionals.push(token);
  }

  return parsed;
}

export async function runCli(argv: string[]): Promise<CliResult> {
  const args = parseArgs(argv);
  if (args.help || !args.command) return { stdout: usage(), stderr: "", exitCode: 0 };

  const command = args.command as Command;
  if (!isCommand(command))
    throw new CliUsageError(`Unknown command: ${args.command}\n\n${usage()}`);

  switch (command) {
    case "crawl":
      return runCrawl(args);
    case "build-index":
      return runBuildIndex(args);
    case "refresh":
      return runRefresh(args);
    case "search":
      return runSearch(args);
    case "show":
      return runShow(args);
    case "stats":
      return runStats(args);
    case "benchmark":
      return runBenchmark(args);
    case "check":
      return runCheck(args);
  }
}

export async function refreshDocs(options: RefreshOptions): Promise<RefreshSummary> {
  const target = path.resolve(options.dataDir);
  const targetPaths = resolveVaultPaths(target);
  const parent = path.dirname(target);
  const baseName = path.basename(target);
  mkdirSync(parent, { recursive: true });

  const staging = mkdtempSync(path.join(parent, `.${baseName}.staging-`));
  let backupDir: string | undefined;
  let oldPublishedMoved = false;

  try {
    if (existsSync(targetPaths.manifestPath)) {
      copyFileSync(targetPaths.manifestPath, path.join(staging, "manifest.json"));
    }

    const crawlResult = await crawlDocs({
      baseUrl: options.baseUrl,
      outputDir: staging,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
    });
    const indexResult = buildIndex({ dataDir: staging });
    const check = checkVault(staging);
    if (!check.ok) {
      throw new Error(`Staged vault failed integrity checks:\n${check.errors.join("\n")}`);
    }

    if (existsSync(target)) {
      backupDir = path.join(
        parent,
        `.${baseName}.backup-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`,
      );
      renameSync(target, backupDir);
      oldPublishedMoved = true;
    }
    renameSync(staging, target);
    cleanupPreviousBackups(parent, baseName, backupDir);

    return {
      dataDir: target,
      documentCount: indexResult.documentCount,
      sectionCount: indexResult.sectionCount,
      report: crawlResult.report,
      check,
      ...(backupDir ? { backupDir } : {}),
    };
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    if (oldPublishedMoved && backupDir && existsSync(backupDir) && !existsSync(target)) {
      renameSync(backupDir, target);
    }
    throw error;
  }
}

export function checkVault(dataDir: string): CheckReport {
  const paths = resolveVaultPaths(path.resolve(dataDir));
  const errors: string[] = [];
  let documents = 0;
  let sections = 0;
  let ftsRows = 0;
  let sourceLinks = 0;
  let manifest: Manifest | undefined;
  let baseUrl: URL | undefined;

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
        validateManifestEntry(entry, index, baseUrl, paths.root);
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

function runCrawl(args: ParsedArgs): Promise<CliResult> {
  const outputDir = resolveDataDir(args.out ?? args.data);
  return crawlDocs({
    baseUrl: args.baseUrl ?? DEFAULT_BASE_URL,
    outputDir,
    concurrency: args.concurrency,
    timeoutMs: args.timeoutMs,
  }).then((result) =>
    formatOutput(
      {
        command: "crawl",
        dataDir: outputDir,
        documents: result.manifest.entries.length,
        report: result.report,
      },
      args.json,
      `Crawled ${result.manifest.entries.length} documentation pages into ${outputDir}.`,
    ),
  );
}

function runBuildIndex(args: ParsedArgs): CliResult {
  const dataDir = resolveDataDir(args.data);
  const result = buildIndex({ dataDir });
  return formatOutput(
    { command: "build-index", dataDir, ...result },
    args.json,
    `Indexed ${result.documentCount} documents and ${result.sectionCount} sections.`,
  );
}

async function runRefresh(args: ParsedArgs): Promise<CliResult> {
  const dataDir = resolveDataDir(args.data);
  const result = await refreshDocs({
    baseUrl: args.baseUrl ?? DEFAULT_BASE_URL,
    dataDir,
    concurrency: args.concurrency,
    timeoutMs: args.timeoutMs,
  });
  return formatOutput(
    { command: "refresh", ...result },
    args.json,
    `Published ${result.documentCount} documents and ${result.sectionCount} sections into ${dataDir}.`,
  );
}

function runSearch(args: ParsedArgs): CliResult {
  const query = args.positionals.join(" ").trim();
  if (!query) throw new CliUsageError("search requires a query");
  const dataDir = resolveDataDir(args.data);
  const paths = resolveVaultPaths(dataDir);
  const results = searchDocs(paths.indexPath, query, { limit: args.limit });
  if (args.json) return formatOutput({ query, results }, true, "");
  return { stdout: formatSearchResults(results), stderr: "", exitCode: 0 };
}

function runShow(args: ParsedArgs): CliResult {
  const identifier = args.positionals.join(" ").trim();
  if (!identifier) throw new CliUsageError("show requires a document id or URL");
  const dataDir = resolveDataDir(args.data);
  const paths = resolveVaultPaths(dataDir);
  const manifest = readManifest(paths.manifestPath);
  const entry = manifest.entries.find(
    (candidate) => candidate.id === identifier || candidate.url === identifier,
  );
  if (!entry) throw new Error(`Document not found in manifest: ${identifier}`);

  const section = args.section ?? "markdown";
  if (section === "html" || section === "markdown") {
    const relativePath = section === "html" ? entry.htmlPath : entry.markdownPath;
    const filePath = resolveManifestPath(paths.root, relativePath);
    const content = readFileSync(filePath, "utf8");
    if (args.json) {
      return formatOutput(
        {
          id: entry.id,
          title: entry.title,
          url: entry.url,
          sha256: entry.sha256,
          section,
          content,
        },
        true,
        "",
      );
    }
    return { stdout: ensureTrailingNewline(content), stderr: "", exitCode: 0 };
  }

  if (!/^\d+$/.test(section)) {
    throw new CliUsageError(
      `Unknown section: ${section} (use markdown, html, or a zero-based number)`,
    );
  }
  const index = Number(section);
  const markdownPath = resolveManifestPath(paths.root, entry.markdownPath);
  const sections = sectionizeMarkdown(readFileSync(markdownPath, "utf8"), entry.title);
  const selected = sections[index];
  if (!selected) throw new Error(`Section ${index} does not exist in document ${entry.id}`);
  const content = selected.body || selected.title;
  if (args.json) {
    return formatOutput(
      {
        id: entry.id,
        title: entry.title,
        url: entry.url,
        sha256: entry.sha256,
        section: index,
        headingPath: selected.headingPath,
        content,
      },
      true,
      "",
    );
  }
  return { stdout: ensureTrailingNewline(content), stderr: "", exitCode: 0 };
}

function runStats(args: ParsedArgs): CliResult {
  const dataDir = resolveDataDir(args.data);
  const paths = resolveVaultPaths(dataDir);
  const manifest = readManifest(paths.manifestPath);
  const db = new DatabaseSync(paths.indexPath, { readOnly: true });
  try {
    const result = {
      dataDir,
      rootUrl: manifest.rootUrl,
      generatedAt: manifest.generatedAt,
      documents: countRows(db, "documents"),
      sections: countRows(db, "sections"),
      ftsRows: countRows(db, "sections_fts"),
      bytes: statSync(paths.indexPath).size,
    };
    return formatOutput(
      result,
      args.json,
      `${result.documents} documents, ${result.sections} sections.`,
    );
  } finally {
    db.close();
  }
}

function runCheck(args: ParsedArgs): CliResult {
  const report = checkVault(resolveDataDir(args.data));
  if (args.json) {
    return { ...formatOutput(report, true, ""), exitCode: report.ok ? 0 : 1 };
  }
  if (!report.ok) throw new Error(`Vault check failed:\n${report.errors.join("\n")}`);
  return {
    stdout: `OK: ${report.documents} documents, ${report.sections} sections, ${report.ftsRows} FTS rows, ${report.sourceLinks} source links.\n`,
    stderr: "",
    exitCode: 0,
  };
}

function runBenchmark(args: ParsedArgs): CliResult {
  const dataDir = resolveDataDir(args.data);
  const paths = resolveVaultPaths(dataDir);
  const iterations = args.iterations ?? 100;
  if (iterations < 1 || iterations > 10_000) {
    throw new CliUsageError("--iterations must be between 1 and 10000");
  }

  const coldDurations: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const query = benchmarkQuery(iteration);
    const start = performance.now();
    runColdSearchProcess(dataDir, query);
    coldDurations.push(performance.now() - start);
  }

  const warmDurations: number[] = [];
  const index = openSearchIndex(paths.indexPath);
  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const query = benchmarkQuery(iteration);
      const start = performance.now();
      index.search(query);
      warmDurations.push(performance.now() - start);
    }
  } finally {
    index.close();
  }

  const report: BenchmarkReport = {
    dataDir,
    iterations,
    queries: BENCHMARK_QUERIES,
    coldProcessMs: summarizeDurations(coldDurations),
    warmProcessMs: summarizeDurations(warmDurations),
  };
  return formatOutput(
    report,
    args.json,
    `Benchmark: cold p50/p95 ${report.coldProcessMs.p50.toFixed(2)}/${report.coldProcessMs.p95.toFixed(2)} ms; warm p50/p95 ${report.warmProcessMs.p50.toFixed(2)}/${report.warmProcessMs.p95.toFixed(2)} ms.`,
  );
}

function runColdSearchProcess(dataDir: string, query: string): void {
  const entry = process.argv[1];
  if (!entry) throw new Error("Cannot locate the CLI entry point for the cold benchmark");
  const child = spawnSync(
    process.execPath,
    [...process.execArgv, path.resolve(entry), "search", query, "--json", "--data", dataDir],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Cold benchmark search failed with exit code ${child.status}: ${child.stderr}`);
  }
}

function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No results.\n";
  return `${results
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}${result.headingPath.length ? ` — ${result.headingPath.join(" / ")}` : ""}\n` +
        `   ${result.snippet}\n` +
        `   URL: ${result.url}\n` +
        `   Source: ${result.sourcePath}\n` +
        `   SHA-256: ${result.sha256}`,
    )
    .join("\n\n")}\n`;
}

function formatOutput(value: unknown, json: boolean, human: string): CliResult {
  return {
    stdout: json ? `${JSON.stringify(value, null, 2)}\n` : `${human}\n`,
    stderr: "",
    exitCode: 0,
  };
}

function assignValue(args: ParsedArgs, flag: string, value: string): void {
  switch (flag) {
    case "--data":
      args.data = value;
      break;
    case "--out":
      args.out = value;
      break;
    case "--base-url":
      args.baseUrl = value;
      break;
    case "--section":
      args.section = value;
      break;
    case "--limit":
      args.limit = parsePositiveInteger(flag, value);
      break;
    case "--iterations":
      args.iterations = parsePositiveInteger(flag, value);
      break;
    case "--concurrency":
      args.concurrency = parsePositiveInteger(flag, value);
      break;
    case "--timeout-ms":
      args.timeoutMs = parsePositiveInteger(flag, value);
      break;
  }
}

function parsePositiveInteger(flag: string, value: string): number {
  if (!/^\d+$/.test(value)) throw new CliUsageError(`${flag} requires a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new CliUsageError(`${flag} requires a positive integer`);
  }
  return parsed;
}

function validateManifestEntry(
  entry: ManifestEntry,
  index: number,
  baseUrl: URL | undefined,
  root: string,
): void {
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

function benchmarkQuery(iteration: number): string {
  return BENCHMARK_QUERIES[iteration % BENCHMARK_QUERIES.length] ?? "project trust";
}

function countRows(db: DatabaseSync, tableOrQuery: string): number {
  const query = tableOrQuery.includes(" ")
    ? tableOrQuery
    : `SELECT COUNT(*) AS count FROM ${tableOrQuery}`;
  const row = db.prepare(query).get() as { count?: number | bigint };
  return Number(row.count ?? 0);
}

function summarizeDurations(values: number[]): PercentileReport {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number): number => {
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const lowerValue = sorted[lower] ?? 0;
    const upperValue = sorted[upper] ?? lowerValue;
    return lowerValue + (upperValue - lowerValue) * (position - lower);
  };
  return {
    count: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
  };
}

function cleanupPreviousBackups(parent: string, baseName: string, keep: string | undefined): void {
  const prefix = `.${baseName}.backup-`;
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.name.startsWith(prefix)) continue;
    const candidate = path.join(parent, entry.name);
    if (candidate === keep) continue;
    rmSync(candidate, { recursive: true, force: true });
  }
}

function resolveDataDir(value: string | undefined): string {
  return path.resolve(value ?? process.env.PI_DOCS_VAULT_ROOT ?? path.join(process.cwd(), "data"));
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function isCommand(value: string): value is Command {
  return new Set<Command>([
    "crawl",
    "build-index",
    "refresh",
    "search",
    "show",
    "stats",
    "benchmark",
    "check",
  ]).has(value as Command);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usage(): string {
  return `pi-docs — local, source-linked Pi documentation search

Usage:
  pi-docs crawl [--base-url URL] [--data DIR] [--out DIR]
  pi-docs build-index [--data DIR]
  pi-docs refresh [--base-url URL] [--data DIR]
  pi-docs search <query> [--limit N] [--data DIR] [--json]
  pi-docs show <doc-id-or-url> [--section markdown|html|N] [--data DIR] [--json]
  pi-docs stats [--data DIR] [--json]
  pi-docs benchmark [--iterations N] [--data DIR] [--json]
  pi-docs check [--data DIR] [--json]
`;
}

async function main(): Promise<void> {
  try {
    const result = await runCli(process.argv.slice(2));
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  } catch (error) {
    const exitCode = error instanceof CliUsageError ? error.exitCode : 1;
    process.stderr.write(`Error: ${errorMessage(error)}\n`);
    process.exitCode = exitCode;
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (entryPath && entryPath === fileURLToPath(import.meta.url)) {
  void main();
}
