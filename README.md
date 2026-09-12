# Pi Agent Vault

This repository builds a source-faithful, offline search vault for the official Pi documentation at `https://pi.dev/docs/latest`.

The fetched HTML under `data/sources/` is the fidelity anchor. Markdown and SQLite FTS5 rows are derived search artifacts; every manifest record keeps the canonical URL and SHA-256 needed to check them.

The implementation is separate from the Pi coding-agent CLI. It provides the corpus builder, local `pi-docs` CLI, read-only Pi extension, narrowly triggered skill, and Windows installation/portable-export scripts. It does not install Pi, authenticate a provider, read credentials, start Docker, or install QEMU.

## Development

```text
npm ci --ignore-scripts
npm run check
npx tsx src/cli.ts --help
```

The live crawl is explicit because it is the only operation that uses the network:

```text
npx tsx src/cli.ts refresh --base-url https://pi.dev/docs/latest --data C:/absolute/path/pi-agent-vault/data
npx tsx src/cli.ts check --data C:/absolute/path/pi-agent-vault/data
npx tsx src/cli.ts search "Type.Object registerTool" --json --data C:/absolute/path/pi-agent-vault/data
```

With npm 12, pass script flags after a second `--` when using the package script, for example `npm run pi-docs -- refresh -- --data C:/absolute/path/data`. The direct `npx tsx` form avoids that npm argument-forwarding detail.

## Windows installation

After `data/` has been refreshed and checked, run PowerShell 7 or Windows PowerShell:

```powershell
pwsh -NoProfile -File scripts/install-pi-integration.ps1 `
  -VaultRoot (Resolve-Path data) `
  -PortableOutput 'C:\Users\littl\Documents\Codex\2026-09-12\pi\outputs\pi-agent-vault'
```

The installer copies only the read-only extension, the `pi-docs-kb` skill, a `pi-docs-kb.json` pointer, the `pi-docs.cmd` shim, and the selected portable artifacts. Existing destination files are backed up before replacement. Use `-Uninstall` to remove only files recorded in the machine pointer; backups, credentials, sessions, and unrelated skills remain untouched. See `docs/operations.md` for recovery and refresh procedures.

The Pi extension reads the vault path from `PI_DOCS_VAULT_ROOT` or `%USERPROFILE%\.pi\agent\pi-docs-kb.json`. Restart Pi after installation so the extension and skill are rediscovered.

The portable export contains the source entry points and lockfile alongside the corpus. From the portable directory, run `npm ci --ignore-scripts` once before using its `pi-docs.cmd` shim; subsequent `search`, `show`, `stats`, `benchmark`, and `check` operations are local.
