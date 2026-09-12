import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashBytes, readManifest, writeManifest, type Manifest } from "../src/manifest.js";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("manifest persistence", () => {
  it("round-trips a manifest and preserves UTF-8 JSON", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-manifest-"));
    temporaryRoots.push(root);
    const filePath = path.join(root, "manifest.json");
    const manifest: Manifest = {
      version: 1,
      rootUrl: "https://pi.dev/docs/latest",
      generatedAt: "2026-09-12T00:00:00.000Z",
      entries: [
        {
          id: "quickstart",
          url: "https://pi.dev/docs/latest/quickstart",
          title: "Quickstart",
          retrievedAt: "2026-09-12T00:00:00.000Z",
          sha256: "abc",
          htmlPath: "sources/quickstart.html",
          markdownPath: "sources/quickstart.md",
          contentHash: "def",
        },
      ],
    };

    writeManifest(filePath, manifest);

    expect(readManifest(filePath)).toEqual(manifest);
    expect(readFileSync(filePath, "utf8")).toContain('"rootUrl": "https://pi.dev/docs/latest"');
  });

  it("hashes bytes deterministically", () => {
    expect(hashBytes(new TextEncoder().encode("pi"))).toBe(
      "85b42e1702877c851eb7412fe958c8fb447c3207b4798fadab42ea8539046ce1",
    );
  });
});
