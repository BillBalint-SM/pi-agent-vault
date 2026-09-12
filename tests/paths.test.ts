import { describe, expect, it } from "vitest";
import { resolveVaultPaths } from "../src/paths.js";

describe("resolveVaultPaths", () => {
  it("derives all generated locations below the selected root", () => {
    const paths = resolveVaultPaths("C:/vault");

    expect(paths.sourcesDir).toBe("C:/vault/sources");
    expect(paths.indexPath).toBe("C:/vault/index/pi-docs.sqlite");
    expect(paths.manifestPath).toBe("C:/vault/manifest.json");
  });

  it("rejects an empty or relative root", () => {
    expect(() => resolveVaultPaths("")).toThrow(/root/i);
    expect(() => resolveVaultPaths("vault")).toThrow(/absolute/i);
  });
});
