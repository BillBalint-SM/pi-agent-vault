import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPage } from "../src/extract.js";

const quickstartHtml = readFileSync(new URL("./fixtures/quickstart.html", import.meta.url), "utf8");

describe("extractPage", () => {
  it("extracts the article title and useful Markdown", () => {
    const page = extractPage(quickstartHtml, "https://pi.dev/docs/latest/quickstart");

    expect(page.title).toBe("Quickstart");
    expect(page.markdown).toContain("Install");
    expect(page.markdown).toContain("npm install -g --ignore-scripts");
    expect(page.markdown).not.toContain("Search documentation");
    expect(page.markdown).not.toContain("Footer-only text");
  });

  it("preserves code blocks and creates heading-bounded sections", () => {
    const page = extractPage(quickstartHtml, "https://pi.dev/docs/latest/quickstart");

    expect(page.articleHtml).toContain("@earendil-works/pi-coding-agent");
    expect(page.sections.some((section) => section.headingPath.includes("Authenticate"))).toBe(
      true,
    );
    expect(page.sections.some((section) => section.headingPath.includes("First session"))).toBe(
      true,
    );
  });
});
