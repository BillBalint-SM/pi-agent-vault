import { readFileSync, rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../src/index.js";
import { checkVault as cliCheckVault, runCli } from "../src/cli.js";
import { checkVault as moduleCheckVault } from "../src/vault-check.js";
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

  it("re-exports the deep VaultCheck function for source compatibility", () => {
    expect(cliCheckVault).toBe(moduleCheckVault);
  });

  it("preserves the human check output", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });

    const result = await runCli(["check", "--data", fixture.root]);

    expect(result).toEqual({
      stdout: "OK: 2 documents, 6 sections, 6 FTS rows, 2 source links.\n",
      stderr: "",
      exitCode: 0,
    });
  });

  it("maps a failed report to JSON exit code 1", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    rmSync(fixture.dbPath, { force: true });

    const result = await runCli(["check", "--json", "--data", fixture.root]);
    const report = JSON.parse(result.stdout) as { ok: boolean; errors: string[] };

    expect(result.exitCode).toBe(1);
    expect(report.ok).toBe(false);
    expect(result.stderr).toBe("");
    expect(report.errors[0]).toMatch(/^index: missing/);
  });

  it("preserves the human failure prefix", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    rmSync(fixture.dbPath, { force: true });

    await expect(runCli(["check", "--data", fixture.root])).rejects.toThrow(
      /^Vault check failed:\nindex: missing/,
    );
  });
});
