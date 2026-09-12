import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pi-docs-kb skill", () => {
  it("routes Pi implementation questions to bounded local retrieval", () => {
    const skill = readFileSync(
      new URL("../pi/skills/pi-docs-kb/SKILL.md", import.meta.url),
      "utf8",
    );

    expect(skill).toMatch(/CLI|providers|settings|sessions|extensions|skills|packages|SDK|RPC/i);
    expect(skill).toContain("pi_docs_search");
    expect(skill).toContain("pi-docs show");
    expect(skill).toMatch(/official URL|source hash/i);
    expect(skill).toMatch(/stale|fresh|refresh/i);
    expect(skill).not.toContain("Paste the entire documentation");
  });
});
