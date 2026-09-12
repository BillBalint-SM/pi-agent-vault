import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

  it("refuses to uninstall a pointer that names an unrelated Pi file", () => {
    if (process.platform !== "win32") return;

    const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-uninstall-"));
    roots.push(root);
    const piAgentDir = path.join(root, "pi-agent");
    mkdirSync(piAgentDir, { recursive: true });
    const authPath = path.join(piAgentDir, "auth.json");
    const pointerPath = path.join(piAgentDir, "pi-docs-kb.json");
    writeFileSync(authPath, "must survive\n", "utf8");
    writeFileSync(pointerPath, JSON.stringify({ version: 1, installedFiles: [authPath] }), "utf8");

    const scriptPath = fileURLToPath(
      new URL("../scripts/install-pi-integration.ps1", import.meta.url),
    );
    const result = spawnSync(
      "pwsh",
      ["-NoProfile", "-File", scriptPath, "-Uninstall", "-PiAgentDir", piAgentDir],
      { encoding: "utf8", windowsHide: true },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(authPath)).toBe(true);
  });

  it("refuses to install through an intermediate reparse point", () => {
    if (process.platform !== "win32") return;

    const root = mkdtempSync(path.join(os.tmpdir(), "pi-vault-reparse-install-"));
    roots.push(root);
    const piAgentDir = path.join(root, "pi-agent");
    const portableOutput = path.join(root, "portable");
    const outsideDir = path.join(root, "outside");
    const extensionParent = path.join(piAgentDir, "extensions");
    mkdirSync(extensionParent, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    symlinkSync(outsideDir, path.join(extensionParent, "pi-docs-kb"), "junction");

    const scriptPath = fileURLToPath(
      new URL("../scripts/install-pi-integration.ps1", import.meta.url),
    );
    const vaultRoot = fileURLToPath(new URL("../data", import.meta.url));
    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        scriptPath,
        "-VaultRoot",
        vaultRoot,
        "-PiAgentDir",
        piAgentDir,
        "-PortableOutput",
        portableOutput,
      ],
      { encoding: "utf8", windowsHide: true },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(path.join(outsideDir, "index.ts"))).toBe(false);
    expect(existsSync(path.join(piAgentDir, "pi-docs-kb.json"))).toBe(false);
  });
});
