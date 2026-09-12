import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface ManifestEntry {
  id: string;
  url: string;
  title: string;
  retrievedAt: string;
  sha256: string;
  htmlPath: string;
  markdownPath: string;
  contentHash: string;
}

export interface Manifest {
  version: 1;
  rootUrl: string;
  generatedAt: string;
  entries: ManifestEntry[];
}

export interface RedirectRecord {
  from: string;
  to: string;
}

export interface RefreshReport {
  rootUrl: string;
  generatedAt: string;
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
  errors: string[];
  redirects: RedirectRecord[];
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function writeManifest(filePath: string, manifest: Manifest): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function readManifest(filePath: string): Manifest {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isManifest(parsed)) {
    throw new Error(`Invalid manifest: ${filePath}`);
  }
  return parsed;
}

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Manifest>;
  return (
    candidate.version === 1 &&
    typeof candidate.rootUrl === "string" &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.entries)
  );
}
