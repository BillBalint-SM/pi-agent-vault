# Operations

## First use

1. Install the locked project dependencies with `npm ci --ignore-scripts`.
2. Crawl and stage the official docs with `npx tsx src/cli.ts refresh --base-url https://pi.dev/docs/latest --data C:/absolute/path/data`.
3. Run `npx tsx src/cli.ts check --data C:/absolute/path/data` and keep the report green before using the extension.
4. Install the Pi integration with `scripts/install-pi-integration.ps1` or copy the generated portable directory to a controlled location.
5. Restart Pi. Ask Pi a Pi implementation question; the `pi-docs-kb` skill routes it to `pi_docs_search`.

The query path is local after the snapshot exists. `search` returns bounded snippets with a canonical URL, source path, and SHA-256. `show` is the explicit full-page/context path.

## Common commands

```text
npx tsx src/cli.ts search "project trust" --data C:/absolute/path/data
npx tsx src/cli.ts search "RPC mode stdin stdout" --json --limit 5 --data C:/absolute/path/data
npx tsx src/cli.ts show extensions --section markdown --data C:/absolute/path/data
npx tsx src/cli.ts stats --json --data C:/absolute/path/data
npx tsx src/cli.ts check --json --data C:/absolute/path/data
npx tsx src/cli.ts benchmark --iterations 100 --json --data C:/absolute/path/data
```

The CLI never uses the network for `search`, `show`, `stats`, `benchmark`, or `check`. Only `crawl` and `refresh` fetch pages.

The explicit `check` command and the pre-publication stage of `refresh` use the same `VaultCheck` module. It opens the local SQLite index read-only and reconciles the manifest, source hashes, paths, derived sections, and FTS relationships before a staged vault can be published.

Release validation for `VaultCheck` uses an LF checkout because the corpus hashes its exact source bytes. The regression gate compares the old and new integrity implementations in that same environment; historical timings from a different checkout remain context, not an absolute runtime target.

## Refresh and rollback

`refresh` crawls into a random sibling staging directory, builds the SQLite index, validates the staged manifest/files/FTS rows, and only then swaps the published data directory. A failed crawl or check removes only staging, leaving the previous directory usable.

After a successful swap, the previous published directory is retained as the newest sibling `.data.backup-*`. Keep it until the next successful refresh or until you have independently verified the new snapshot. If a publication step is interrupted, restore the newest backup by renaming it to the configured data directory after checking that no current directory is present.

Do not edit `data/sources/*.html` or the manifest by hand. If a source needs to be corrected, refresh from the official URL and record the changed hash in the refresh report.

## Installer recovery

The installer creates collision backups under `%USERPROFILE%\.pi\agent\backups\pi-docs-kb-*` and under the portable output's `backups\` directory. To recover a replaced file, stop Pi, copy the desired backup file back to its original path, and restart Pi. The uninstall operation does not delete these backups.

The pointer records the absolute vault root, its manifest hash, and the machine files owned by this integration. Uninstall reads only that pointer and refuses paths outside the Pi resource directory. It does not modify `AGENTS.md`, `settings.json`, `auth.json`, session JSONL files, provider configuration, or unrelated skills.

## Toolchain and boundaries

The project uses the installed Node.js 26 runtime, TypeScript, `tsx`, Node's built-in `node:sqlite`/FTS5, `linkedom`, `turndown`, TypeBox, ESLint, Prettier, and Vitest. The official Pi coding-agent package is a local development-only compatibility dependency for typechecking; the Pi CLI is not installed globally by this project.

Docker is not started, QEMU is not installed, and no API/provider credentials are configured by this project. Pi itself remains a local agent with the permissions of the account running it; this read-only extension does not turn Pi into a sandbox.
