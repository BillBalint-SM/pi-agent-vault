import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { hashBytes, writeManifest, type Manifest } from "../src/manifest.js";

export interface TestVault {
  root: string;
  dbPath: string;
  cleanup: () => void;
}

export function createIndexFixture(): TestVault {
  const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-index-"));
  const sourcesDir = path.join(root, "sources");
  const indexDir = path.join(root, "index");
  mkdirSync(sourcesDir, { recursive: true });
  mkdirSync(indexDir, { recursive: true });

  const pages = [
    {
      id: "using-pi",
      title: "Using Pi",
      markdown:
        "# Using Pi\n\n## Project Trust\n\nPi asks before trusting a project folder.\n\n## Sessions\n\nSessions are saved automatically.",
    },
    {
      id: "extensions",
      title: "Extensions",
      markdown:
        "# Extensions\n\n## Tools\n\nRegister a tool with Type.Object.\n\n## Runtime\n\nExtensions run with full permissions.",
    },
  ];

  const entries = pages.map((page) => {
    const html = `<article><h1>${page.title}</h1><p>${page.markdown}</p></article>`;
    writeFileSync(path.join(sourcesDir, `${page.id}.html`), html, "utf8");
    writeFileSync(path.join(sourcesDir, `${page.id}.md`), page.markdown, "utf8");
    return {
      id: page.id,
      url: `https://pi.dev/docs/latest/${page.id}`,
      title: page.title,
      retrievedAt: "2026-09-12T00:00:00.000Z",
      sha256: hashBytes(new TextEncoder().encode(html)),
      htmlPath: `sources/${page.id}.html`,
      markdownPath: `sources/${page.id}.md`,
      contentHash: hashBytes(new TextEncoder().encode(page.markdown)),
    };
  });

  const manifest: Manifest = {
    version: 1,
    rootUrl: "https://pi.dev/docs/latest",
    generatedAt: "2026-09-12T00:00:00.000Z",
    entries,
  };
  writeManifest(path.join(root, "manifest.json"), manifest);

  return {
    root,
    dbPath: path.join(indexDir, "pi-docs.sqlite"),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
