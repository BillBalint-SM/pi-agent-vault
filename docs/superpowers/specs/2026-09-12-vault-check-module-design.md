# VaultCheck Deep Module Design

**Status:** Approved for implementation planning

**Date:** 2026-09-12

## Context

Vault integrity policy currently occupies a wide implementation surface in
`src/cli.ts`. Command routing, output formatting, staged publication, manifest
validation, source hashing, path safety, SQLite reconciliation, section
comparison, and FTS relationship checks are all navigated through the same
file.

The behavior is correct, but its locality and leverage are weak. A change to
integrity policy requires understanding CLI implementation details, and the
current tests exercise detailed integrity behavior through the CLI adapter
instead of through a dedicated interface.

This change is a behavior-preserving harness upgrade. It changes where the
integrity implementation lives and how it is tested; it does not introduce new
integrity rules or change user-visible behavior.

## Goals

- Put all vault integrity policy behind one deep module with a small interface.
- Give CLI checks and staged refreshes leverage over the same implementation.
- Make the deep module interface the test surface for integrity behavior.
- Give maintainers and agents one obvious seam to navigate when changing or
  diagnosing vault integrity.
- Preserve current reports, error ordering, CLI output, exit codes, refresh
  publication behavior, and performance.

## Non-goals

- Adding new integrity rules or changing the meaning of an existing rule.
- Introducing typed findings or changing `CheckReport`.
- Adding a storage port, filesystem port, or second SQLite adapter.
- Changing the manifest format, SQLite schema, index builder, search path, or
  corpus contents.
- Moving the refresh workflow out of `src/cli.ts`.
- Redesigning install layout or path ownership beyond packaging the new source
  file.
- Adding asynchronous or parallel integrity checking.

## Options considered

### One deep `VaultCheck` module

Move the integrity policy into `src/vault-check.ts`. Export only
`checkVault(dataDir)` and `CheckReport`; keep the validation helpers and SQLite
implementation private.

This option maximizes locality and depth while preserving a small interface. It
also lets the CLI and refresh workflow reuse one seam. This is the selected
design.

### One module per validator

Split the policy across files such as `manifest-check.ts`, `source-check.ts`,
`sqlite-check.ts`, and `fts-check.ts`.

This would create several shallow modules and require callers or an orchestrator
to coordinate their intermediate results. It would keep the implementation
surface wide, reduce locality, and make agent navigation harder. This option is
rejected.

### Inject filesystem and SQLite ports

Make `VaultCheck` accept ports with production and test adapters.

The dependencies are local-substitutable: tests can use real temporary files
and a real temporary SQLite database. There is only one justified production
adapter, so public ports would create hypothetical seams and widen the
interface. This option is rejected until a second storage implementation is
actually required.

## Selected module and interface

The new module is `src/vault-check.ts` and exposes exactly this interface:

```ts
export interface CheckReport {
  ok: boolean;
  dataDir: string;
  documents: number;
  sections: number;
  ftsRows: number;
  sourceLinks: number;
  errors: string[];
}

export function checkVault(dataDir: string): CheckReport;
```

`src/cli.ts` imports this interface for its own implementation and re-exports
both names for source compatibility with current imports.

The dependency direction is:

```text
pi-docs check -----------\
                         +--> checkVault(dataDir) --> CheckReport
refreshDocs(staging) ----/
                                  |
                                  +-- manifest and source hashes
                                  +-- canonical URL and path safety
                                  +-- SQLite reconciliation
                                  +-- section content
                                  +-- FTS relationships
```

`VaultCheck` may use the existing pure and local implementation in `crawl.ts`,
`extract.ts`, `index.ts`, `manifest.ts`, and `paths.ts`. Those imports are
implementation details and are not exposed through the new interface.

The existing `resolveManifestPath` export remains in `src/index.ts`; relocating
that helper is not required for this design. Realpath confinement and its error
interpretation remain private integrity policy inside `VaultCheck`.

The small `countRows` helper remains private in each module that needs it. A few
duplicated lines are preferable to introducing a shallow shared SQLite module.

## `VaultCheck` implementation ownership

The implementation owns all of the following behavior:

- resolving and normalizing the selected vault root;
- reading and validating the manifest;
- validating `rootUrl`;
- processing manifest entries in manifest order;
- validating required manifest entry fields;
- validating canonical, in-scope latest-documentation URLs;
- detecting duplicate document IDs and URLs;
- enforcing lexical and realpath source confinement;
- reading original HTML and derived Markdown files;
- verifying the HTML SHA-256 and Markdown content hash;
- deriving expected searchable sections from Markdown;
- opening the SQLite index read-only;
- running `PRAGMA integrity_check`;
- counting document, section, and FTS rows;
- detecting missing and orphan FTS rows;
- reconciling every indexed document field with the manifest;
- reconciling section counts, ordering, heading paths, titles, and bodies;
- detecting missing and orphan document and section rows;
- aggregating recoverable errors in deterministic order; and
- closing the SQLite connection after success or failure.

No validator helper, expected-row type, SQLite row type, path helper, or
internal adapter is exported.

## CLI adapter behavior

`src/cli.ts` retains command parsing, command routing, output formatting, exit
code selection, refresh orchestration, and staged publication. It contains no
manifest, hashing, path-safety, SQLite-reconciliation, section-reconciliation,
or FTS-integrity policy after this change.

The `check` command behavior remains:

- successful JSON check: report on stdout, empty stderr, exit code `0`;
- failed JSON check: failed report on stdout, empty stderr, exit code `1`;
- successful human check: the existing `OK: ...` line and exit code `0`; and
- failed human check: an error beginning with `Vault check failed:`.

There are no new flags, output fields, error codes, or output modes.

## Exact report semantics

`ok` is true exactly when `errors.length` is zero.

`documents` is the SQLite `documents` row count when that query succeeds. If it
cannot be queried, it remains the readable manifest entry count; if neither is
available, it is zero.

`sections` is the SQLite `sections` row count when available and zero otherwise.

`ftsRows` is the SQLite `sections_fts` row count when available and zero
otherwise.

`sourceLinks` is the number of manifest entries that passed field, URL,
uniqueness, path, and source-hash validation.

`dataDir` is the normalized absolute vault root.

Errors retain their current wording and deterministic order:

1. manifest loading or manifest-level URL errors;
2. entry errors in manifest order;
3. index existence, integrity, FTS, document, and section errors in current
   query and iteration order; and
4. the final manifest/index document-count mismatch when applicable.

The module continues after recoverable errors where the current implementation
continues. It does not convert current thrown input/programming errors into
report findings.

## Refresh behavior

The staged refresh sequence remains:

```text
crawl into staging
        |
build SQLite index in staging
        |
checkVault(staging)
        |-- failed --> remove staging; leave published vault untouched
        `-- passed --> move old vault to backup; publish staging
```

`checkVault(staging)` must run before any rename of the published vault. A
failed report is converted to the existing
`Staged vault failed integrity checks:` error. The catch path removes the failed
staging directory, and the existing published manifest, sources, and SQLite
index remain byte-for-byte unchanged.

The refresh test may replace the `VaultCheck` module at an internal test seam to
produce a controlled failed report. This does not add a production port or
widen `RefreshOptions`.

## Read-only and performance properties

`checkVault()` performs no network request and no filesystem or SQLite write. It
uses one read-only SQLite connection, reads each selected HTML and Markdown file
once, and uses a fixed number of aggregate/full-table SQL statements rather
than SQL inside document or section loops.

Its expected complexity remains linear in documents, sections, and FTS rows.

The historical pre-change baseline on the current 30-document, 663-section
corpus, measured as 20 direct warm calls after one warm-up call, was:

- minimum: 18.30 ms;
- median: 20.07 ms;
- p95: 21.62 ms; and
- maximum: 21.99 ms.

Those absolute values are retained as historical context, but are not comparable
in the LF checkout required to validate content-hashed corpus bytes. The
2026-09-12 release ruling therefore uses a controlled same-environment A/B
comparison of the old `c2d2298` `checkVault` implementation and this module:

- old implementation: median 32.088449999999966 ms and p95
  36.831750000000014 ms;
- `VaultCheck`: median 31.70614999999998 ms and p95 34.824790000000306 ms;
- 10% median regression limit: 35.297294999999966 ms; and
- 15% p95 regression limit: 42.35651250000001 ms.

The new module passes both release limits. This proves no regression relative to
the old implementation under the identical executable, Node version, SQLite
file, LF corpus bytes, and measurement process; it is not an absolute
performance guarantee. Normal residual machine-load variation remains a
measurement uncertainty. No new filesystem or SQL operation may appear inside
a corpus-sized loop.

## Testing strategy

Detailed integrity tests move to `tests/vault-check.test.ts` and invoke only the
deep module interface. They use real temporary directories and Node's real local
SQLite implementation; no public test adapter is added.

The interface tests cover:

- a valid vault and exact report counts;
- malformed manifest and invalid root URL;
- duplicate IDs and URLs;
- lexical and, where supported, symlink/junction path escapes;
- HTML and Markdown hash mismatches;
- missing or corrupt SQLite index;
- mismatched, missing, and orphan document rows;
- mismatched, missing, and orphan section rows;
- missing and orphan FTS relationships;
- multiple independent findings in deterministic order; and
- unchanged relevant file hashes before and after a check.

`tests/cli.test.ts` retains only adapter behavior for successful and failed JSON
and human output. Existing detailed source-tamper and reconciliation tests move
to `tests/vault-check.test.ts`; they are not layered at both interfaces.

`tests/refresh.test.ts` retains failed-crawl publication coverage and adds a
controlled staged-integrity-failure case. It verifies unchanged published file
hashes, staging cleanup, and absence of a premature publication rename.

## Portable packaging

The portable `pi-docs.cmd` executes portable `src/cli.ts`, which will import
`src/vault-check.ts`. The new file must therefore be copied into the portable
output.

The implementation updates both sources of install expectations:

- `scripts/install-pi-integration.ps1` adds the file to `$portableFiles`;
- `src/install-plan.ts` adds it to planned portable writes; and
- `tests/installer.test.ts` verifies the planned and materialized portable file.

The machine-installed Pi extension does not import `VaultCheck`, so its managed
file set does not change.

## Expected file changes

- Add `src/vault-check.ts`.
- Add `tests/vault-check.test.ts`.
- Modify `src/cli.ts` to import/re-export and call the deep module interface.
- Narrow `tests/cli.test.ts` to CLI adapter behavior.
- Extend `tests/refresh.test.ts` for staged integrity failure.
- Update `src/install-plan.ts` and `scripts/install-pi-integration.ps1` for the
  portable runtime dependency.
- Extend `tests/installer.test.ts` for packaging coverage.
- Update repository-layout documentation and validation evidence after the
  implementation is verified.

No corpus source, manifest, refresh report, or SQLite data artifact should
change as a consequence of this refactor.

## Acceptance criteria

The change is acceptable only when all of the following are evidenced:

1. `src/vault-check.ts` exports only `checkVault` and `CheckReport`.
2. Integrity policy is absent from `src/cli.ts`; the CLI retains only adapter
   and refresh-orchestration implementation.
3. CLI checks and staged refreshes call the same `VaultCheck` seam.
4. Existing imports through `src/cli.ts` remain source-compatible.
5. Existing fixture reports, relevant error wording/order, JSON, and exit codes
   are unchanged.
6. A staged integrity failure cannot modify the published vault.
7. The portable output contains `src/vault-check.ts`, and a portable
   `pi-docs check --json` command succeeds.
8. `npm run check` exits zero.
9. The live corpus still reports exactly 30 documents, 663 sections, 663 FTS
   rows, 30 source links, and no errors.
10. The live manifest, sources, refresh report, and SQLite database remain
    unchanged by the refactor.
11. The post-change performance measurements meet the defined regression
    limits.
12. One independent final code review has no unresolved in-scope findings.
