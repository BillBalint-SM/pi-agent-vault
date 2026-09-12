import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { openSearchIndex, type ReadonlySearchIndex, type SearchResult } from "./search.js";
import { resolveVaultPaths } from "./paths.js";

const CONFIG_FILE_NAME = "pi-docs-kb.json";

const SearchParameters = Type.Object({
  query: Type.String({ minLength: 1, description: "Documentation terms to search for." }),
  limit: Type.Optional(
    Type.Number({ minimum: 1, maximum: 20, description: "Maximum number of bounded results." }),
  ),
});

type SearchParameters = Static<typeof SearchParameters>;

interface ExtensionState {
  index?: ReadonlySearchIndex;
  error?: string;
}

interface PiDocsToolDetails {
  query?: string;
  resultCount?: number;
  remediation?: string;
}

interface PiDocsConfig {
  vaultRoot: string;
}

export default function piDocsExtension(pi: ExtensionAPI): void {
  const state: ExtensionState = {};

  pi.registerTool({
    name: "pi_docs_search",
    label: "Pi Docs Search",
    description:
      "Search the local, source-linked snapshot of the official Pi documentation. Returns bounded excerpts with the canonical URL and source hash.",
    promptSnippet: "Search official Pi documentation locally with source-linked snippets",
    promptGuidelines: [
      "Use pi_docs_search for Pi CLI, provider, settings, session, extension, skill, package, SDK, or RPC facts.",
      "Treat the returned canonical URL and SHA-256 as evidence; use the local show command for surrounding context.",
    ],
    parameters: SearchParameters,
    executionMode: "parallel",
    execute(_toolCallId, params) {
      if (!state.index) return Promise.resolve(unavailableResult(state.error));
      try {
        const results = state.index.search(params.query, { limit: params.limit });
        return Promise.resolve({
          content: [
            { type: "text", text: JSON.stringify({ query: params.query, results }, null, 2) },
          ],
          details: { query: params.query, resultCount: results.length } satisfies PiDocsToolDetails,
        });
      } catch (error) {
        return Promise.resolve(unavailableResult(errorMessage(error)));
      }
    },
  });

  pi.registerCommand("pi-docs", {
    description: "Search the local official Pi documentation: /pi-docs <query>",
    handler: (args, ctx) => {
      if (!state.index) {
        ctx.ui.notify(unavailableMessage(state.error), "error");
        return Promise.resolve();
      }
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /pi-docs <documentation query>", "warning");
        return Promise.resolve();
      }
      const results = state.index.search(query, { limit: 5 });
      ctx.ui.notify(formatCommandResults(results), results.length > 0 ? "info" : "warning");
      return Promise.resolve();
    },
  });

  pi.on("session_start", () => {
    closeIndex(state);
    try {
      const vaultRoot = resolveConfiguredVaultRoot();
      state.index = openSearchIndex(resolveVaultPaths(vaultRoot).indexPath);
      state.error = undefined;
    } catch (error) {
      state.index = undefined;
      state.error = errorMessage(error);
    }
  });

  pi.on("session_shutdown", () => {
    closeIndex(state);
  });
}

function resolveConfiguredVaultRoot(): string {
  const environmentRoot = process.env.PI_DOCS_VAULT_ROOT?.trim();
  if (environmentRoot) return normalizeAbsoluteRoot(environmentRoot);

  const configPath = path.join(os.homedir(), ".pi", "agent", CONFIG_FILE_NAME);
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<PiDocsConfig>;
  if (typeof parsed.vaultRoot !== "string" || parsed.vaultRoot.trim().length === 0) {
    throw new Error(`Invalid vaultRoot in ${configPath}`);
  }
  return normalizeAbsoluteRoot(parsed.vaultRoot);
}

function normalizeAbsoluteRoot(value: string): string {
  if (!path.isAbsolute(value) && !path.win32.isAbsolute(value)) {
    throw new Error("Configured Pi docs vault root must be absolute");
  }
  return path.resolve(value);
}

function closeIndex(state: ExtensionState): void {
  state.index?.close();
  state.index = undefined;
}

function unavailableResult(detail: string | undefined): {
  content: Array<{ type: "text"; text: string }>;
  details: PiDocsToolDetails;
  isError: true;
} {
  return {
    content: [{ type: "text", text: unavailableMessage(detail) }],
    details: { remediation: "Run the local pi-docs build-index command for the configured vault." },
    isError: true,
  };
}

function unavailableMessage(detail: string | undefined): string {
  return `The local Pi documentation index is unavailable. Run pi-docs build-index, then restart the Pi session.${detail ? ` Detail: ${detail}` : ""}`;
}

function formatCommandResults(results: SearchResult[]): string {
  if (results.length === 0) return "No local Pi documentation results.";
  return results
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}${result.headingPath.length ? ` — ${result.headingPath.join(" / ")}` : ""}\n${result.snippet}\n${result.url}\nSHA-256: ${result.sha256}`,
    )
    .join("\n\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
