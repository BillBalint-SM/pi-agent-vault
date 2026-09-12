import { describe, expect, it } from "vitest";
import { canonicalizeDocsUrl } from "../src/crawl.js";

describe("canonicalizeDocsUrl", () => {
  const baseUrl = new URL("https://pi.dev/docs/latest");

  it("keeps latest documentation links and removes fragments", () => {
    expect(canonicalizeDocsUrl("/docs/latest/usage#sessions", baseUrl)?.href).toBe(
      "https://pi.dev/docs/latest/usage",
    );
  });

  it("normalizes the root trailing slash", () => {
    expect(canonicalizeDocsUrl("https://pi.dev/docs/latest/", baseUrl)?.href).toBe(
      "https://pi.dev/docs/latest",
    );
  });

  it("rejects external, asset, and off-version links", () => {
    expect(canonicalizeDocsUrl("https://example.com/docs/latest", baseUrl)).toBeNull();
    expect(canonicalizeDocsUrl("/docs/old/usage", baseUrl)).toBeNull();
    expect(canonicalizeDocsUrl("/assets/app.js", baseUrl)).toBeNull();
  });
});
