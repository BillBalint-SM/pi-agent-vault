import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIndex } from "../src/index.js";
import { searchDocs } from "../src/search.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault;

beforeEach(() => {
  fixture = createIndexFixture();
  buildIndex({ dataDir: fixture.root });
});

afterEach(() => {
  fixture.cleanup();
});

describe("searchDocs", () => {
  it("returns a heading match before an unrelated body match", () => {
    const results = searchDocs(fixture.dbPath, "project trust", { limit: 5 });

    expect(results[0]?.title).toBe("Using Pi");
    expect(results[0]?.headingPath.join("/")).toMatch(/Project Trust/);
    expect(results[0]?.url).toBe("https://pi.dev/docs/latest/using-pi");
  });

  it("turns invalid FTS syntax into a literal search", () => {
    expect(() => searchDocs(fixture.dbPath, '"unclosed', { limit: 5 })).not.toThrow();
  });

  it("bounds result count and snippet size", () => {
    const results = searchDocs(fixture.dbPath, "extensions", { limit: 100 });

    expect(results.length).toBeLessThanOrEqual(20);
    expect(results[0]?.snippet.length).toBeLessThanOrEqual(1200);
  });
});
