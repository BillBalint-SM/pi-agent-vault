import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export interface InstallPlanInput {
  vaultRoot: string;
  piAgentDir: string;
  portableOutput: string;
  existingFiles: string[];
}

export interface InstallPlan {
  writes: string[];
  backups: string[];
}

export function planInstall(input: InstallPlanInput): InstallPlan {
  const vaultRoot = normalizeAbsolute(input.vaultRoot, "vaultRoot");
  const piAgentDir = normalizeAbsolute(input.piAgentDir, "piAgentDir");
  const portableOutput = normalizeAbsolute(input.portableOutput, "portableOutput");
  const piExtensionDir = path.join(piAgentDir, "extensions", "pi-docs-kb");
  const piSkillDir = path.join(piAgentDir, "skills", "pi-docs-kb");
  const portableExtensionDir = path.join(portableOutput, "pi", "extensions", "pi-docs-kb");
  const portableSkillDir = path.join(portableOutput, "pi", "skills", "pi-docs-kb");

  const writes = [
    path.join(piExtensionDir, "index.ts"),
    path.join(piExtensionDir, "search.ts"),
    path.join(piExtensionDir, "paths.ts"),
    path.join(piSkillDir, "SKILL.md"),
    path.join(piAgentDir, "pi-docs-kb.json"),
    path.join(piAgentDir, "pi-docs.cmd"),
    path.join(portableOutput, "data", "manifest.json"),
    path.join(portableOutput, "data", "refresh-report.json"),
    path.join(portableOutput, "data", "index", "pi-docs.sqlite"),
    path.join(portableOutput, "pi-docs-kb.json"),
    path.join(portableOutput, "pi-docs.cmd"),
    path.join(portableOutput, "README.md"),
    path.join(portableOutput, "docs", "source-policy.md"),
    path.join(portableOutput, "scripts", "install-pi-integration.ps1"),
    path.join(portableOutput, "package.json"),
    path.join(portableOutput, "package-lock.json"),
    path.join(portableOutput, "src", "cli.ts"),
    path.join(portableOutput, "src", "crawl.ts"),
    path.join(portableOutput, "src", "extract.ts"),
    path.join(portableOutput, "src", "index.ts"),
    path.join(portableOutput, "src", "install-plan.ts"),
    path.join(portableOutput, "src", "manifest.ts"),
    path.join(portableOutput, "src", "paths.ts"),
    path.join(portableOutput, "src", "pi-extension.ts"),
    path.join(portableOutput, "src", "search.ts"),
    path.join(portableExtensionDir, "index.ts"),
    path.join(portableExtensionDir, "search.ts"),
    path.join(portableExtensionDir, "paths.ts"),
    path.join(portableSkillDir, "SKILL.md"),
    ...listFiles(path.join(vaultRoot, "sources")).map((sourcePath) =>
      path.join(portableOutput, "data", "sources", path.relative(vaultRoot, sourcePath)),
    ),
  ];

  const uniqueWrites = [...new Set(writes.map((file) => path.resolve(file)))].sort();
  const writeSet = new Set(uniqueWrites);
  const backups = [
    ...new Set(
      input.existingFiles.map((file) => path.resolve(file)).filter((file) => writeSet.has(file)),
    ),
  ].sort();

  return { writes: uniqueWrites, backups };
}

function normalizeAbsolute(value: string, name: string): string {
  if (value.trim().length === 0) throw new Error(`${name} is required`);
  if (!path.isAbsolute(value) && !path.win32.isAbsolute(value)) {
    throw new Error(`${name} must be absolute`);
  }
  return path.resolve(value);
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(candidate));
    else if (entry.isFile() && statSync(candidate).isFile()) files.push(candidate);
  }
  return files;
}
