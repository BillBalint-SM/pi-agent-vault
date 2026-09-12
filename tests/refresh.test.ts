import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

let fixture: TestVault | undefined;

afterEach(() => {
  fixture?.cleanup();
  fixture = undefined;
});

describe("staged refresh", () => {
  it("leaves the previously published manifest intact when crawl fails", async () => {
    fixture = createIndexFixture();
    const previousManifest = JSON.parse(
      readFileSync(`${fixture.root}/manifest.json`, "utf8"),
    ) as unknown;
    const unreachableUrl = "http://127.0.0.1:1/docs/latest";

    await expect(
      runCli(["refresh", "--base-url", unreachableUrl, "--data", fixture.root]),
    ).rejects.toThrow();

    expect(JSON.parse(readFileSync(`${fixture.root}/manifest.json`, "utf8"))).toEqual(
      previousManifest,
    );
  });
});
