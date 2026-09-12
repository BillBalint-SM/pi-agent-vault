import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../src/index.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault | undefined;

afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
});

describe("buildIndex", () => {
  it("builds documents, heading-bounded sections, and an FTS5 table", () => {
    fixture = createIndexFixture();

    const result = buildIndex({ dataDir: fixture.root });
    const db = new DatabaseSync(result.dbPath, { readOnly: true });

    expect(result.documentCount).toBe(2);
    expect(result.sectionCount).toBe(6);
    expect(db.prepare("SELECT count(*) AS count FROM sections_fts").get()).toEqual({ count: 6 });
    db.close();
  });
});
