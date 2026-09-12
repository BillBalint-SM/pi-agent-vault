import { appendFileSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../src/index.js";
import { runCli } from "../src/cli.js";
import { readManifest, writeManifest } from "../src/manifest.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault | undefined;

afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
});

describe("pi-docs CLI", () => {
  it("search prints bounded JSON with source links", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });

    const result = await runCli(["search", "project trust", "--json", "--data", fixture.root]);
    const payload = JSON.parse(result.stdout) as {
      results: Array<{ url: string; snippet: string }>;
    };

    expect(payload.results[0]?.url).toMatch(/^https:\/\/pi\.dev\/docs\/latest/);
    expect(payload.results[0]?.snippet.length).toBeLessThanOrEqual(1200);
  });

  it("shows a manifest-selected source and reports index stats", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });

    const shown = await runCli(["show", "using-pi", "--section", "html", "--data", fixture.root]);
    expect(shown.stdout).toContain("Using Pi");

    const stats = await runCli(["stats", "--json", "--data", fixture.root]);
    expect(JSON.parse(stats.stdout)).toMatchObject({ documents: 2, sections: 6 });
  });

  it("check verifies the fixture and emits a machine-readable result", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });

    const result = await runCli(["check", "--json", "--data", fixture.root]);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, documents: 2, sections: 6 });
    expect(readFileSync(fixture.dbPath)).toBeTruthy();
  });

  it("check rejects a tampered source snapshot", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    appendFileSync(`${fixture.root}/sources/using-pi.html`, "<!-- tampered -->", "utf8");

    const result = await runCli(["check", "--json", "--data", fixture.root]);
    const report = JSON.parse(result.stdout) as { ok: boolean; errors: string[] };

    expect(result.exitCode).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => /SHA-256 mismatch/i.test(error))).toBe(true);
  });

  it("check rejects an index whose document row disagrees with the manifest", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    const manifest = readManifest(`${fixture.root}/manifest.json`);
    const firstEntry = manifest.entries[0];
    if (!firstEntry) throw new Error("Fixture manifest is empty");
    firstEntry.title = "Changed after indexing";
    writeManifest(`${fixture.root}/manifest.json`, manifest);

    const result = await runCli(["check", "--json", "--data", fixture.root]);
    const report = JSON.parse(result.stdout) as { ok: boolean; errors: string[] };

    expect(result.exitCode).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => /document.*mismatch|manifest.*index/i.test(error))).toBe(
      true,
    );
    expect(report.errors.some((error) => /section.*mismatch/i.test(error))).toBe(true);
  });
});
