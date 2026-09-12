# Source policy

## Authority

The corpus accepts only pages from the official Pi documentation scope rooted at `https://pi.dev/docs/latest`. The crawler follows same-origin links below that normalized path and rejects external domains, other documentation versions, assets, fragments, and unsupported response types.

The original response bytes are stored unchanged as `data/sources/<slug>.html`. They are the fidelity anchor for audits and refresh comparisons. The adjacent Markdown file is generated for agent retrieval and is not authoritative.

## Evidence

Each manifest entry records its canonical URL, retrieval time, original HTML SHA-256, derived Markdown content hash, and both relative source paths. Search results repeat the canonical URL and original source hash so an agent can cite the exact snapshot used.

`pi-docs check` verifies that the manifest-selected files exist, remain inside the vault, match their hashes, remain in scope, and have corresponding SQLite/FTS rows. A changed official page is reported as changed on refresh; it is never silently merged into an old local copy.

## Use and updates

Treat this directory as a local mirror for documentation retrieval, not as a license to remove notices or misrepresent the official project. Preserve the URL and hash when quoting or applying a rule. Refresh from the official site when freshness matters, and state the snapshot retrieval time when it may affect the answer.

The repository deliberately does not mirror Pi credentials, sessions, provider files, arbitrary GitHub repositories, package registries, or user project instructions. It does not infer that a documented behavior is a security guarantee for an untrusted or unattended Pi run.
