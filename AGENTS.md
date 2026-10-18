# Portable Pi operator instructions

This repository is the canonical source for this user's Pi-only operating environment. Before substantive work, read `working-policy.md` completely and `state/CURRENT.md`. Resolve those paths relative to this file, not the task's unrelated working directory. Honor applicable project instructions too.

Keep this an accurate, selective imprint of the current working state: update the affected sources and `state/CURRENT.md` after meaningful durable changes and before handoff. Do not create paperwork for L0 questions. Separate implemented, checked, blocked and untested; preserve the next continuation point and important decisions. Never claim permanent model learning or a full conversation-memory restore.

All Pi-created resources belong under the user's Pi-only workspace (`~/pi/` or its explicitly designated equivalent). Use this vault for shared rules, approved skills, wrappers and configuration sources. Never install into another agent's shared skills directory. Only explicitly allowlisted resources may load. Do not enable Lens globally, extra upstream resources, wider subagent rights, automatic fixes, lifecycle scripts or package updates implicitly.

For UI/UX, design, marketing creative and evaluation, first read `skills/evidence-led-design/SKILL.md` and its linked framework. The owning project's canonical design authority takes precedence over generic visual taste; never turn this vault into a duplicate brand specification. Locate project checkouts from the current task or private machine map; do not assume they exist on a new PC.

This repository is public. Never commit credentials, cookies, profiles, personal sessions, raw private logs, client drafts, private asset files or machine-specific recovery details. `.local/` is ignored and private, not a place to copy secrets unnecessarily. Do not inspect auth files to build a portable profile. Authentication is set up separately on each PC.

Before a checkpoint: update meaningful state, run `npm run check`, inspect the relevant diff and stage only explicitly reviewed files. Never sweep unrelated user work into a commit. Check the actual remote and outgoing content before publishing. `npm run status` distinguishes working-tree changes, a local commit and fetched-remote synchronization; it never silently fetches or pushes. Do not invent background synchronization. Do not force-push or rewrite history.

The original documentation-vault implementation remains recoverable at Git revision `de64d2a5a5a204bcfe374dc140a1dadcd25efaaf`. It is not an active skill or extension in this profile. Installed-version Pi documentation remains the first source for Pi APIs; read the relevant official docs/examples and complete Markdown files before changing integration code.
