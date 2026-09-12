import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { planInstall } from "../src/install-plan.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function isBelow(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

describe("planInstall", () => {
  it("plans only scoped writes and backs up collisions", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-install-"));
    roots.push(root);
    const piAgentDir = path.join(root, "pi-agent");
    const portableOutput = path.join(root, "portable");
    const existingSkill = path.join(piAgentDir, "skills", "pi-docs-kb", "SKILL.md");
    const plan = planInstall({
      vaultRoot: path.join(root, "vault"),
      piAgentDir,
      portableOutput,
      existingFiles: [existingSkill],
    });

    expect(
      plan.writes.every((file) => isBelow(piAgentDir, file) || isBelow(portableOutput, file)),
    ).toBe(true);
    expect(plan.backups).toContain(existingSkill);
    expect(plan.writes).toContain(path.join(piAgentDir, "pi-docs-kb.json"));
  });

  it("does not include auth, session, or provider files", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-install-"));
    roots.push(root);
    const plan = planInstall({
      vaultRoot: path.join(root, "vault"),
      piAgentDir: path.join(root, "pi-agent"),
      portableOutput: path.join(root, "portable"),
      existingFiles: [],
    });

    expect(plan.writes.some((file) => /auth|session|models\.json/i.test(file))).toBe(false);
  });
});
