import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractPage, type ExtractedPage } from "./extract.js";
import {
  hashBytes,
  readManifest,
  type Manifest,
  type ManifestEntry,
  type RefreshReport,
  writeManifest,
} from "./manifest.js";
import { resolveVaultPaths } from "./paths.js";

export interface CrawlOptions {
  baseUrl: string;
  outputDir: string;
  concurrency?: number;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

export interface CrawlResult {
  manifest: Manifest;
  report: RefreshReport;
  outputDir: string;
}

interface FetchedPage {
  url: string;
  bytes: Uint8Array;
  extracted: ExtractedPage;
}

export function canonicalizeDocsUrl(input: string, baseUrl: URL): URL | null {
  let candidate: URL;
  try {
    candidate = new URL(input, baseUrl);
  } catch {
    return null;
  }

  if (candidate.origin !== baseUrl.origin) return null;

  const rootPath = normalizePath(baseUrl.pathname);
  const candidatePath = normalizePath(candidate.pathname);
  if (candidatePath !== rootPath && !candidatePath.startsWith(`${rootPath}/`)) return null;

  const finalSegment = candidatePath.split("/").at(-1) ?? "";
  if (/\.[a-z\d]{1,12}$/i.test(finalSegment)) return null;

  candidate.pathname = candidatePath;
  candidate.search = "";
  candidate.hash = "";
  return candidate;
}

export async function crawlDocs(options: CrawlOptions): Promise<CrawlResult> {
  const baseUrl = new URL(options.baseUrl);
  const rootUrl = canonicalizeDocsUrl(baseUrl.href, baseUrl);
  if (!rootUrl) throw new Error(`Base URL is outside the documentation scope: ${options.baseUrl}`);

  const vaultPaths = resolveVaultPaths(options.outputDir);
  mkdirSync(vaultPaths.sourcesDir, { recursive: true });
  mkdirSync(vaultPaths.derivedDir, { recursive: true });
  mkdirSync(vaultPaths.indexDir, { recursive: true });

  const queue = [rootUrl.href];
  const seen = new Set(queue);
  const pages: FetchedPage[] = [];
  const fetchPage = options.fetchImpl ?? fetch;
  const concurrency = clampInteger(options.concurrency ?? 4, 1, 8);

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) return;

      const fetched = await fetchHtml(url, fetchPage, options);
      pages.push(fetched);
      for (const link of fetched.extracted.links) {
        const next = canonicalizeDocsUrl(link, baseUrl);
        if (next && !seen.has(next.href)) {
          seen.add(next.href);
          queue.push(next.href);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  pages.sort((left, right) => left.url.localeCompare(right.url));
  const usedSlugs = new Set<string>();
  const entries: ManifestEntry[] = [];
  for (const page of pages) {
    const slug = uniqueSlug(page.url, baseUrl, usedSlugs);
    const htmlPath = path.join(vaultPaths.sourcesDir, `${slug}.html`);
    const markdownPath = path.join(vaultPaths.sourcesDir, `${slug}.md`);
    writeFileSync(htmlPath, page.bytes);
    writeFileSync(markdownPath, page.extracted.markdown, "utf8");
    entries.push({
      id: slug,
      url: page.url,
      title: page.extracted.title,
      retrievedAt: new Date().toISOString(),
      sha256: hashBytes(page.bytes),
      htmlPath: toPortablePath(path.relative(vaultPaths.root, htmlPath)),
      markdownPath: toPortablePath(path.relative(vaultPaths.root, markdownPath)),
      contentHash: hashBytes(new TextEncoder().encode(page.extracted.markdown)),
    });
  }

  const manifest: Manifest = {
    version: 1,
    rootUrl: rootUrl.href,
    generatedAt: new Date().toISOString(),
    entries,
  };
  const report = createRefreshReport(vaultPaths.manifestPath, manifest);
  writeManifest(vaultPaths.manifestPath, manifest);
  writeFileSync(vaultPaths.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return { manifest, report, outputDir: vaultPaths.root };
}

async function fetchHtml(
  url: string,
  fetchImpl: typeof fetch,
  options: CrawlOptions,
): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "text/html",
        "user-agent": options.userAgent ?? "pi-agent-vault/0.1 (+https://pi.dev/docs/latest)",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Expected text/html but received ${contentType || "unknown content type"}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const html = new TextDecoder().decode(bytes);
    return { url, bytes, extracted: extractPage(html, url) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch ${url}: ${message}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

function createRefreshReport(manifestPath: string, current: Manifest): RefreshReport {
  const previous = tryReadManifest(manifestPath);
  const previousByUrl = new Map(previous?.entries.map((entry) => [entry.url, entry]) ?? []);
  const currentUrls = new Set(current.entries.map((entry) => entry.url));
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const entry of current.entries) {
    const old = previousByUrl.get(entry.url);
    if (!old) added.push(entry.url);
    else if (old.sha256 === entry.sha256) unchanged.push(entry.url);
    else changed.push(entry.url);
  }

  const removed =
    previous?.entries.map((entry) => entry.url).filter((url) => !currentUrls.has(url)) ?? [];

  return {
    rootUrl: current.rootUrl,
    generatedAt: current.generatedAt,
    added,
    changed,
    removed,
    unchanged,
    errors: [],
  };
}

function tryReadManifest(filePath: string): Manifest | undefined {
  try {
    return readManifest(filePath);
  } catch (error) {
    if (isFileMissing(error)) return undefined;
    throw error;
  }
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function uniqueSlug(url: string, baseUrl: URL, used: Set<string>): string {
  const pathname = new URL(url).pathname.slice(normalizePath(baseUrl.pathname).length);
  const relative = pathname.replace(/^\/+|\/+$/g, "") || "index";
  const decoded = decodeURIComponent(relative);
  const base =
    decoded
      .split("/")
      .filter(Boolean)
      .join("--")
      .replace(/[^a-z\d_-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "index";
  let slug = base;
  if (used.has(slug)) slug = `${base}-${hashBytes(new TextEncoder().encode(url)).slice(0, 8)}`;
  used.add(slug);
  return slug;
}

function normalizePath(value: string): string {
  const normalized = `/${value.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "/" ? normalized : normalized.replace(/\/{2,}/g, "/");
}

function toPortablePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}
