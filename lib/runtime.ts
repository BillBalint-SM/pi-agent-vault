import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const vaultRoot = fileURLToPath(new URL("../", import.meta.url));
export function localPath(relative: string): string {
  return path.join(vaultRoot, ".local", relative);
}
export function hostRoot(): string {
  const config = JSON.parse(fs.readFileSync(localPath("host.json"), "utf8"));
  if (!path.isAbsolute(config.root) || !fs.existsSync(path.join(config.root, "dist/index.js"))) {
    throw new Error("Pi host moved or is missing. Run the vault setup again before loading extensions.");
  }
  return config.root;
}
