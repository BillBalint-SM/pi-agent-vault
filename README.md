# Pi Agent Vault

This repository builds a source-faithful, offline search vault for the official Pi documentation at `https://pi.dev/docs/latest`.

The implementation is intentionally separate from the Pi coding agent CLI. It provides the documentation corpus, a local SQLite FTS5 index, a `pi-docs` CLI, and a read-only Pi extension/skill kit.

## Development

```text
npm install --ignore-scripts
npm run check
npm run pi-docs -- --help
```

The live crawl is an explicit operation because it is the only command that uses the network. Credentials, provider authentication, Docker startup, and QEMU installation are outside this project.
