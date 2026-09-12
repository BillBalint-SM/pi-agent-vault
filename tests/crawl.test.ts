import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { crawlDocs } from "../src/crawl.js";

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("crawlDocs", () => {
  it("crawls same-origin latest pages and writes source/derived files", async () => {
    const indexHtml = readFileSync(new URL("./fixtures/docs-index.html", import.meta.url), "utf8");
    const quickstartHtml = readFileSync(
      new URL("./fixtures/quickstart.html", import.meta.url),
      "utf8",
    );
    const llamaHtml = readFileSync(new URL("./fixtures/llama-cpp.html", import.meta.url), "utf8");
    const server = createServer((request, response) => {
      const body =
        request.url === "/docs/latest/quickstart"
          ? quickstartHtml
          : request.url === "/docs/latest/llama-cpp"
            ? llamaHtml
            : indexHtml;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(body);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Test server did not expose a port");

    const outputDir = mkdtempSync(path.join(os.tmpdir(), "pi-vault-crawl-"));
    roots.push(outputDir);
    const result = await crawlDocs({
      baseUrl: `http://127.0.0.1:${address.port}/docs/latest`,
      outputDir,
      concurrency: 2,
    });

    expect(result.manifest.entries.map((entry) => entry.title)).toEqual([
      "Pi Documentation",
      "llama.cpp",
      "Quickstart",
    ]);
    expect(readFileSync(path.join(outputDir, "sources", "quickstart.html"), "utf8")).toContain(
      "@earendil-works/pi-coding-agent",
    );
    expect(readFileSync(path.join(outputDir, "sources", "quickstart.md"), "utf8")).toContain(
      "Authenticate",
    );
    expect(result.report.errors).toEqual([]);
  });
});
