import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPage, MAX_SECTION_CHARS, sectionizeMarkdown } from "../src/extract.js";

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

  it("does not invent empty heading path segments when a page starts below H1", () => {
    const page = extractPage(
      "<article><h2>Configuration</h2><h3>Settings</h3><p>Use the settings file.</p></article>",
      "https://pi.dev/docs/latest/settings",
    );

    expect(page.sections.map((section) => section.headingPath)).toEqual([
      ["Configuration"],
      ["Configuration", "Settings"],
    ]);
  });

  it("splits an oversized section into bounded deterministic chunks", () => {
    const sections = sectionizeMarkdown(`# Long\n\n${"alpha ".repeat(2000)}`, "Long");

    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((section) => section.body.length <= MAX_SECTION_CHARS)).toBe(true);
    expect(sections.map((section) => section.ordinal)).toEqual(sections.map((_, index) => index));
    expect(sections.map((section) => section.headingPath)).toEqual(sections.map(() => ["Long"]));
  });
});
