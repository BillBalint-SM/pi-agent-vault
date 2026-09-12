# Official Pi documentation research

**Scope.** This is a primary-source-only inventory of the documentation navigation at [`https://pi.dev/docs/latest`](https://pi.dev/docs/latest), checked on 2026-09-12. The navigation definition is the official repository's [`packages/coding-agent/docs/docs.json`](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/docs/docs.json), at commit `71dca871bc80b6bc97be37f0ca3189399d651fff`. The rendered route for each item was verified on `pi.dev`; the title below is the page's H1, and the navigation label is shown when it differs.

**Boundary.** The manifest contains 29 sidebar-navigation pages. The Overview body also links to `llama-cpp`, but that page is not an item in the latest documentation navigation manifest, so it is intentionally outside this enumeration. No third-party sources were used.

## Complete latest-navigation inventory

| Navigation group | Navigation label → official page title | Canonical URL |
|---|---|---|
| Start here | Overview → Pi Documentation | <https://pi.dev/docs/latest> |
| Start here | Quickstart → Quickstart | <https://pi.dev/docs/latest/quickstart> |
| Start here | Using Pi → Using Pi | <https://pi.dev/docs/latest/usage> |
| Start here | Providers → Providers | <https://pi.dev/docs/latest/providers> |
| Start here | Security → Security | <https://pi.dev/docs/latest/security> |
| Start here | Containerization → Containerization | <https://pi.dev/docs/latest/containerization> |
| Start here | Settings → Settings | <https://pi.dev/docs/latest/settings> |
| Start here | Keybindings → Keybindings | <https://pi.dev/docs/latest/keybindings> |
| Start here | Sessions → Sessions | <https://pi.dev/docs/latest/sessions> |
| Start here | Compaction → Compaction & Branch Summarization | <https://pi.dev/docs/latest/compaction> |
| Customization | Extensions → Extensions | <https://pi.dev/docs/latest/extensions> |
| Customization | Skills → Skills | <https://pi.dev/docs/latest/skills> |
| Customization | Prompt Templates → Prompt Templates | <https://pi.dev/docs/latest/prompt-templates> |
| Customization | Themes → Themes | <https://pi.dev/docs/latest/themes> |
| Customization | Pi Packages → Pi Packages | <https://pi.dev/docs/latest/packages> |
| Customization | Custom Models → Custom Models | <https://pi.dev/docs/latest/models> |
| Customization | Custom Providers → Custom Providers | <https://pi.dev/docs/latest/custom-provider> |
| Reference | Environment Variables → Environment Variables | <https://pi.dev/docs/latest/environment-variables> |
| Reference | Session Format → Session File Format | <https://pi.dev/docs/latest/session-format> |
| Programmatic Usage | SDK → SDK | <https://pi.dev/docs/latest/sdk> |
| Programmatic Usage | RPC Mode → RPC Mode | <https://pi.dev/docs/latest/rpc> |
| Programmatic Usage | JSON Event Stream Mode → JSON Event Stream Mode | <https://pi.dev/docs/latest/json> |
| Programmatic Usage | TUI Components → TUI Components | <https://pi.dev/docs/latest/tui> |
| Platform Setup | Windows → Windows Setup | <https://pi.dev/docs/latest/windows> |
| Platform Setup | Termux on Android → Termux (Android) Setup | <https://pi.dev/docs/latest/termux> |
| Platform Setup | tmux → tmux Setup | <https://pi.dev/docs/latest/tmux> |
| Platform Setup | Terminal Setup → Terminal Setup | <https://pi.dev/docs/latest/terminal-setup> |
| Platform Setup | Shell Aliases → Shell Aliases | <https://pi.dev/docs/latest/shell-aliases> |
| Development | Development → Development | <https://pi.dev/docs/latest/development> |

The navigation groups and item paths above come directly from the official [navigation manifest](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/docs/docs.json). The page URLs are the rendered canonical routes of those paths, not guessed file names.

## Findings for a local documentation corpus

### What Pi officially provides

- Pi describes itself as a small terminal coding harness, extended through TypeScript extensions, skills, prompt templates, themes, and Pi packages. [Overview](https://pi.dev/docs/latest)
- A custom extension can register a model-callable tool with `pi.registerTool`, commands, event handlers, and terminal UI; TypeScript source is loaded through jiti, so compilation is not required for a local extension. [Extensions: Quick Start and Writing an Extension](https://pi.dev/docs/latest/extensions#quick-start)
- The extension tool API supports TypeBox parameter schemas, cancellation, streaming progress, structured `details`, and custom rendering. A tool signals failure by throwing, rather than by returning an error-shaped result. [Extensions: Custom Tools](https://pi.dev/docs/latest/extensions#custom-tools)
- Pi explicitly requires custom tools to truncate output so it does not overrun model context. Its built-in ceiling is 50 KB or 2,000 lines, whichever is reached first; it exports `truncateHead`, `truncateTail`, and related helpers. [Extensions: Output Truncation](https://pi.dev/docs/latest/extensions#output-truncation)
- Extensions can register many tools while initially enabling only a loader; their own official example calls this `search_tools` and says the search implementation could be BM25, embeddings, a remote catalog, or project-specific routing. The general fallback still works where native deferred tool loading is unavailable. [Extensions: Dynamic Tool Loading](https://pi.dev/docs/latest/extensions#dynamic-tool-loading)
- Extension state that must survive/reconstruct correctly across session branches should be written into tool-result `details`, then rebuilt from the active session branch at `session_start`. [Extensions: State Management](https://pi.dev/docs/latest/extensions#state-management)

### SQLite / FTS status

- **No official prescription found.** The 29-page latest-navigation corpus contains no SQLite or FTS guidance. This is a documentation-coverage observation, not a claim that Pi cannot use either.
- **Inference — suitable seam:** keep corpus ingestion, SQLite storage, FTS querying, ranking, and result shaping inside a local extension's model-callable search tool. This follows the documented custom-tool API, search-tool pattern, structured session state, and truncation rule; SQLite/FTS itself remains an implementation choice, not official Pi guidance. [Extensions](https://pi.dev/docs/latest/extensions)
- **Inference — result contract:** return a small ranked, citation-rich result set to the model, expose a separate read/open operation for a selected document or range, and retain any indexing metadata needed for session continuity in `details`. This is inferred from Pi's explicit output-truncation and state-reconstruction rules, rather than stated as an FTS design. [Extensions: Output Truncation](https://pi.dev/docs/latest/extensions#output-truncation), [Extensions: State Management](https://pi.dev/docs/latest/extensions#state-management)

### Local placement, paths, and configuration

- Global extensions are auto-discovered from `~/.pi/agent/extensions/*.ts` and subdirectory `index.ts` files; project-local extensions use `.pi/extensions` with the same shapes, but load only after project trust. Explicit extension paths can also be configured in settings. [Extensions: Extension Locations](https://pi.dev/docs/latest/extensions#extension-locations)
- Settings can point to local extension, skill, prompt, and theme paths. Paths in global settings resolve relative to `~/.pi/agent`; paths in `.pi/settings.json` resolve relative to `.pi`; absolute paths and `~` are accepted. [Settings: Resources](https://pi.dev/docs/latest/settings#resources)
- Local package paths are referenced without copying. A file loads as one extension; a directory is scanned as a package. Relative local package paths resolve relative to the settings file that declares them. [Pi Packages: Local Paths](https://pi.dev/docs/latest/packages#local-paths)
- Pi sessions are auto-saved as per-working-directory JSONL files under `~/.pi/agent/sessions/` by default. The `sessionDir` setting or its higher-precedence command/environment overrides can relocate them. [Sessions](https://pi.dev/docs/latest/sessions), [Settings: Sessions](https://pi.dev/docs/latest/settings#sessions)
- Shell tools receive `PI_SESSION_ID`, `PI_SESSION_FILE`, provider/model, and reasoning-level metadata. The session-file variable is an absolute JSONL path when the session is persistent; it is not injected into `!`/`!!` user-entered shell commands. [Environment Variables](https://pi.dev/docs/latest/environment-variables)

### Skills

- Skills are progressive disclosure: at startup Pi scans names and descriptions and advertises them in the system prompt; the full `SKILL.md` is read only when the task matches or the user explicitly invokes `/skill:name`. [Skills: How Skills Work](https://pi.dev/docs/latest/skills#how-skills-work)
- Skill discovery includes global `~/.pi/agent/skills/` and `~/.agents/skills/`; trusted project `.pi/skills/` and `.agents/skills/` up the project hierarchy; packages; settings; and repeatable `--skill` paths. `--no-skills` disables discovery but not explicit `--skill` paths. [Skills: Locations](https://pi.dev/docs/latest/skills#locations)
- A skill directory requires `SKILL.md`; the supporting `scripts/`, `references/`, and `assets/` layout is freeform. Its frontmatter requires a lowercase/hyphenated `name` and a non-empty `description`; malformed or description-less skills are warned about and not loaded. [Skills: Skill Structure and Validation](https://pi.dev/docs/latest/skills#skill-structure)
- Pi warns that a skill can direct the model to take any action and can contain executable code that the model invokes; review content before use. [Skills: Locations](https://pi.dev/docs/latest/skills#locations)
- **Inference — division of responsibility:** use a skill to teach the agent when and how to query a local corpus, but put the actual SQLite/FTS access behind an extension tool. That keeps native database behavior in code while retaining Pi's on-demand instructional workflow. [Skills](https://pi.dev/docs/latest/skills), [Extensions](https://pi.dev/docs/latest/extensions)

### Packages and TypeScript dependency rules

- A package may explicitly declare `pi.extensions`, `pi.skills`, `pi.prompts`, and `pi.themes` in `package.json`, or rely on conventional `extensions/`, `skills/`, `prompts/`, and `themes/` directories. The conventional extension directory loads `.ts` and `.js`; skills recursively find `SKILL.md` folders and top-level Markdown skills. [Pi Packages: Creating a Pi Package and Package Structure](https://pi.dev/docs/latest/packages#creating-a-pi-package)
- For local extension development, the supported imports include `@earendil-works/pi-coding-agent` for extension types/API, `typebox` for tool schemas, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, Node built-ins, and normal npm dependencies. A nearby or parent `package.json` plus `npm install` enables `node_modules` resolution. [Extensions: Available Imports](https://pi.dev/docs/latest/extensions#available-imports)
- For installed npm/git packages, runtime dependencies belong in `dependencies`, because Pi normally installs production dependencies and does not make `devDependencies` available at runtime. Pi core packages should be peer dependencies with a `"*"` range and must not be bundled. [Extensions: Available Imports](https://pi.dev/docs/latest/extensions#available-imports), [Pi Packages: Dependencies](https://pi.dev/docs/latest/packages#dependencies)
- Project package settings are shared/team-visible, and Pi automatically installs missing configured project packages only after that project is trusted. [Pi Packages: Install and Manage](https://pi.dev/docs/latest/packages#install-and-manage)

### Windows and TypeScript development

- On Windows, Pi looks first for a configured shell path, then `C:\Program Files\Git\bin\bash.exe`, then `bash.exe` on `PATH`; the docs say Git for Windows is sufficient for most users. [Windows Setup](https://pi.dev/docs/latest/windows)
- The optional model-facing `powershell` tool uses `pwsh.exe` if present and otherwise Windows PowerShell. It launches with `-NoProfile -NonInteractive -ExecutionPolicy Bypass`, although administrator policy can prevail. `defaultTools` can replace or accompany `bash`; editor `!` and `!!` still use Bash. [Windows Setup](https://pi.dev/docs/latest/windows)
- Settings require forward slashes or escaped backslashes for Windows paths. The documented Windows `defaultTools` example uses `read`, `powershell`, `edit`, and `write`. [Settings: Shell and Tools](https://pi.dev/docs/latest/settings#shell)
- Extension `.ts` source works without a compile step via jiti. For a multi-file extension, Pi documents an `index.ts` entry-point directory; for dependencies, it documents a local `package.json`, lockfile, `node_modules`, and a `pi.extensions` entry. [Extensions: Writing an Extension](https://pi.dev/docs/latest/extensions#writing-an-extension)
- In the Pi source repository, official development setup is clone → `npm install` → `npm run build`; `pi-test.sh` runs from source while preserving the caller's working directory. `./test.sh` is the non-LLM suite, `npm test` is the full suite, and `npm run check:package-install` validates the packed public packages in a temporary outside-repository installation. [Development](https://pi.dev/docs/latest/development)
- Source-repository code that needs package assets must use helpers from `src/config.ts`, rather than `__dirname`, because Pi supports npm, standalone, and source execution modes. [Development: Path Resolution](https://pi.dev/docs/latest/development#path-resolution)

### Security and trust boundaries

- Pi is a local agent with the starting user account's permissions. Files writable by that user are inside the same local trust boundary. [Security](https://pi.dev/docs/latest/security)
- Project trust gates loading project-local settings, resources, packages, and extensions; it is not a sandbox and does not restrict later model-requested tool actions. Project trust is stored by canonical directory in `~/.pi/agent/trust.json`; the default interactive policy is `ask`. [Security: Project Trust](https://pi.dev/docs/latest/security#project-trust)
- Context files such as `AGENTS.md` and `CLAUDE.md` still load even when project trust is declined unless context loading is disabled. Before trust resolves, Pi loads only context files, user/global extensions, and CLI `-e` extensions. [Security: Project Trust](https://pi.dev/docs/latest/security#project-trust)
- In non-interactive modes, `ask` and `never` ignore protected project resources without a saved decision, while `always` trusts them; `--approve` and `--no-approve` override trust for one run. [Security: Project Trust](https://pi.dev/docs/latest/security#project-trust)
- Pi has no built-in sandbox. Built-in tools and extensions run with the Pi process's permissions; project trust does not make hostile repository content, prompt injection, or model output safe. [Security: No Built-in Sandbox](https://pi.dev/docs/latest/security#no-built-in-sandbox)
- For untrusted, unattended, or insufficiently monitored work, the official guidance is OS/VM/container/policy isolation with minimal files, credentials, and network access; writable host bind mounts still permit host changes. [Security: Running Untrusted or Unmonitored Work](https://pi.dev/docs/latest/security#running-untrusted-or-unmonitored-work), [Containerization](https://pi.dev/docs/latest/containerization)
- **Inference — corpus threat model:** treat repository-provided documentation and project-local skills as potentially instruction-bearing content, not merely inert search records. Do not auto-trust a project just because it contains a corpus; use an explicit trust decision and isolate indexing/querying when corpus provenance is untrusted. This follows Pi's stated local-agent and prompt-injection model. [Security](https://pi.dev/docs/latest/security)

### Updates, offline behavior, and version pinning

- `pi update` updates Pi itself; `pi update --all` updates Pi, packages, and reconciles pinned git refs; `pi update --extensions` handles package/ref reconciliation only; `pi update --models` refreshes model catalogs; `pi update --self` updates only Pi. [Pi Packages: Install and Manage](https://pi.dev/docs/latest/packages#install-and-manage)
- Versioned npm specs are pinned and skipped by package updates. Git packages use pinned tags or commits: package update reconciles the configured ref but does not advance it to a newer ref. Updating the reference requires an explicit `pi install ...@new-ref`. [Pi Packages: Package Sources](https://pi.dev/docs/latest/packages#package-sources)
- Updating a git package can reset and clean its clone and run `npm install` when a `package.json` exists. This is official behavior and is relevant before treating a package checkout as a working directory. [Pi Packages: Package Sources](https://pi.dev/docs/latest/packages#package-sources)
- `enableInstallTelemetry` controls the anonymous install/update ping and certain provider attribution headers, but not version checks. `PI_SKIP_VERSION_CHECK=1` disables the version query; `--offline` or `PI_OFFLINE=1` disables all listed startup network work, including update checks, package-update checks, and install/update telemetry. [Settings: Telemetry and update checks](https://pi.dev/docs/latest/settings#telemetry-and-update-checks), [Environment Variables](https://pi.dev/docs/latest/environment-variables)

## Implementation-relevant conclusion (inferences, not Pi requirements)

For `pi-agent-vault`, the closest documented integration is a **local TypeScript extension** registered from a trusted, explicit local path, exposing a narrow custom search/open tool. A companion **skill** can provide the agent's query and citation procedure through progressive disclosure. SQLite/FTS is a reasonable private implementation behind that tool, but Pi's documentation does not endorse a database, schema, ranking algorithm, or index location. Bound model-visible results, persist only the minimum branch-reconstructible state, pin any distributable package versions, and do not confuse project trust with execution isolation. These are inferences from the cited extension, skill, package, update, and security guidance above.
