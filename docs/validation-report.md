# Pi Agent Vault validation report

Validated on 2026-09-12 on Windows with Node.js 26.7.0.

## Corpus and index

- Source root: `https://pi.dev/docs/latest`
- Snapshot retrieval time: `2026-09-12T14:20:00.493Z`
- Manifest entries: 30
- Original HTML snapshots: 30
- Derived Markdown snapshots: 30
- Heading-bounded searchable sections: 663
- SQLite FTS5 rows: 663
- SQLite file size: 958,464 bytes
- Refresh report: 30 unchanged, 0 added, 0 changed, 0 removed, 0 errors
- `pi-docs check --json`: `ok: true`; all source hashes, content hashes, canonical URLs, file paths, database counts, FTS row relationships, and source links passed

The official navigation inventory contains 29 latest-documentation sidebar pages. The root page also links to the official `llama-cpp` documentation page, so the crawl contains 30 reachable pages. The original HTML response is retained for every entry; Markdown and FTS content are derived and never replace that source anchor.

## Representative search cases

Every query returned bounded results with an official `https://pi.dev/docs/latest/...` URL and a source hash. The first ranked result was:

| Query                      | First page       | URL                                           | Result count | Snippet length |
| -------------------------- | ---------------- | --------------------------------------------- | -----------: | -------------: |
| `project trust`            | Settings         | `https://pi.dev/docs/latest/settings`         |            5 |            313 |
| `defaultTools powershell`  | Windows Setup    | `https://pi.dev/docs/latest/windows`          |            2 |            364 |
| `Type.Object registerTool` | Extensions       | `https://pi.dev/docs/latest/extensions`       |            5 |            396 |
| `pi install package`       | Pi Packages      | `https://pi.dev/docs/latest/packages`         |            5 |            426 |
| `RPC mode stdin stdout`    | RPC Mode         | `https://pi.dev/docs/latest/rpc`              |            5 |            316 |
| `session format JSONL`     | Sessions         | `https://pi.dev/docs/latest/sessions`         |            5 |            325 |
| `containerization Docker`  | Containerization | `https://pi.dev/docs/latest/containerization` |            5 |            253 |
| `provider API key`         | Quickstart       | `https://pi.dev/docs/latest/quickstart`       |            5 |            259 |

## Latency benchmark

Command: `node --import=tsx/esm src/cli.ts benchmark --data data --iterations 100 --json`.

The cold path starts a new Node process and opens a read-only SQLite connection for each query. The warm path reuses one read-only SQLite connection. Eight representative queries were cycled for 100 iterations. Values are measured wall-clock milliseconds on this Windows machine; they are not portable performance guarantees.

| Path         | Samples |       p50 |       p95 |       Min |       Max |
| ------------ | ------: | --------: | --------: | --------: | --------: |
| Cold process |     100 | 266.80 ms | 280.12 ms | 255.64 ms | 286.13 ms |
| Warm process |     100 |  0.216 ms |  0.376 ms |  0.059 ms |  3.159 ms |

## Integration checks

- `npm run check`: passed; 12 test files and 32 tests, plus format, lint, and typecheck.
- The installed `C:\Users\littl\.pi\agent\pi-docs.cmd stats --json` shim returned the 30-document/663-section index statistics without network access.
- The official Pi extension loader smoke test loaded `C:\Users\littl\.pi\agent\extensions\pi-docs-kb\index.ts` with `errors: []`.
- The temporary installer install/uninstall test wrote only scoped files, then removed only the pointer-listed machine files and left backups/unrelated resources untouched.

## Scope notes

The project installs the TypeScript/SQLite/search toolchain locally in the repository and the read-only Pi integration under the user resource directory. It does not install the Pi coding-agent CLI globally, configure provider credentials, modify auth/session/provider files, start Docker, or install QEMU.
