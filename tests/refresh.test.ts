import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIndex } from "../src/index.js";
import { hashBytes } from "../src/manifest.js";
import type { CheckReport } from "../src/vault-check.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault | undefined;
let server: Server | undefined;

afterEach(async () => {
  if (server?.listening) {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
  server = undefined;
  fixture?.cleanup();
  fixture = undefined;
  vi.doUnmock("../src/vault-check.js");
  vi.resetModules();
});

function publishedDigests(vault: TestVault): Record<string, string> {
  return Object.fromEntries(
    [
      "manifest.json",
      "index/pi-docs.sqlite",
      "sources/extensions.html",
      "sources/extensions.md",
      "sources/using-pi.html",
      "sources/using-pi.md",
    ].map((relativePath) => [
      relativePath,
      hashBytes(readFileSync(path.join(vault.root, relativePath))),
    ]),
  );
}

async function startDocsServer(): Promise<string> {
  server = createServer((request, response) => {
    if (request.url === "/docs/latest") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        "<!doctype html><html><head><title>Test Docs</title></head><body><main><h1>Test Docs</h1><p>Local refresh fixture.</p></main></body></html>",
      );
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP address");
  return `http://127.0.0.1:${address.port}/docs/latest`;
}

describe("staged refresh", () => {
  it("leaves the previously published manifest intact when crawl fails", async () => {
    fixture = createIndexFixture();
    const previousManifest = JSON.parse(
      readFileSync(`${fixture.root}/manifest.json`, "utf8"),
    ) as unknown;
    const unreachableUrl = "http://127.0.0.1:1/docs/latest";
    const { runCli } = await import("../src/cli.js");

    await expect(
      runCli(["refresh", "--base-url", unreachableUrl, "--data", fixture.root]),
    ).rejects.toThrow();

    expect(JSON.parse(readFileSync(`${fixture.root}/manifest.json`, "utf8"))).toEqual(
      previousManifest,
    );
  });

  it("removes failed staging and preserves every published byte when VaultCheck fails", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    const before = publishedDigests(fixture);
    const parent = path.dirname(fixture.root);
    const baseName = path.basename(fixture.root);
    const managedSiblingNames = () =>
      readdirSync(parent)
        .filter(
          (name) =>
            name.startsWith(`.${baseName}.staging-`) || name.startsWith(`.${baseName}.backup-`),
        )
        .sort();
    const siblingsBefore = managedSiblingNames();
    const failedCheck = vi.fn(
      (dataDir: string): CheckReport => ({
        ok: false,
        dataDir: path.resolve(dataDir).replaceAll("\\", "/"),
        documents: 1,
        sections: 1,
        ftsRows: 1,
        sourceLinks: 1,
        errors: ["forced staged integrity failure"],
      }),
    );
    vi.doMock("../src/vault-check.js", async () => {
      const actual = await vi.importActual("../src/vault-check.js");
      return { ...actual, checkVault: failedCheck };
    });
    const { refreshDocs } = await import("../src/cli.js");
    const baseUrl = await startDocsServer();

    await expect(refreshDocs({ baseUrl, dataDir: fixture.root })).rejects.toThrow(
      "Staged vault failed integrity checks:\nforced staged integrity failure",
    );

    expect(failedCheck).toHaveBeenCalledTimes(1);
    expect(path.basename(failedCheck.mock.calls[0]?.[0] ?? "")).toMatch(
      new RegExp(`^\\.${baseName}\\.staging-`),
    );
    expect(publishedDigests(fixture)).toEqual(before);
    expect(managedSiblingNames()).toEqual(siblingsBefore);
  });
});
