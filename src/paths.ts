import path from "node:path";

export interface VaultPaths {
  root: string;
  sourcesDir: string;
  derivedDir: string;
  indexDir: string;
  indexPath: string;
  manifestPath: string;
  reportPath: string;
}

function toPortablePath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function resolveVaultPaths(root: string): VaultPaths {
  if (root.trim().length === 0) {
    throw new Error("Vault root is required");
  }

  if (!path.isAbsolute(root) && !path.win32.isAbsolute(root)) {
    throw new Error("Vault root must be absolute");
  }

  const normalizedRoot = toPortablePath(path.resolve(root));
  const join = (...parts: string[]) => toPortablePath(path.join(normalizedRoot, ...parts));

  return {
    root: normalizedRoot,
    sourcesDir: join("sources"),
    derivedDir: join("derived"),
    indexDir: join("index"),
    indexPath: join("index", "pi-docs.sqlite"),
    manifestPath: join("manifest.json"),
    reportPath: join("refresh-report.json"),
  };
}
