import type {
  ExtensionAPI,
  RegisteredCommand,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIndex } from "../src/index.js";
import piDocsExtension from "../src/pi-extension.js";
import { createIndexFixture, type TestVault } from "./test-vault.js";

interface FakeExtensionApi {
  tools: ToolDefinition[];
  commands: Array<{ name: string; options: Omit<RegisteredCommand, "name" | "sourceInfo"> }>;
  handlers: Map<string, (...args: unknown[]) => unknown>;
}

let fixture: TestVault | undefined;

afterEach(() => {
  vi.unstubAllEnvs();
  fixture?.cleanup();
  fixture = undefined;
});

function createFakeApi(): FakeExtensionApi {
  return {
    tools: [],
    commands: [],
    handlers: new Map(),
  };
}

function installExtension(api: FakeExtensionApi): void {
  piDocsExtension({
    registerTool: (tool: ToolDefinition) => api.tools.push(tool),
    registerCommand: (name: string, options: Omit<RegisteredCommand, "name" | "sourceInfo">) =>
      api.commands.push({ name, options }),
    on: (event: string, handler: (...args: unknown[]) => unknown) =>
      api.handlers.set(event, handler),
  } as unknown as ExtensionAPI);
}

function context() {
  return {
    ui: { notify: vi.fn() },
    hasUI: true,
    mode: "tui" as const,
    cwd: process.cwd(),
  };
}

describe("pi_docs_search extension", () => {
  it("registers the documented read-only tool and returns source-linked results", async () => {
    fixture = createIndexFixture();
    buildIndex({ dataDir: fixture.root });
    vi.stubEnv("PI_DOCS_VAULT_ROOT", fixture.root);
    const api = createFakeApi();
    installExtension(api);

    expect(api.tools).toHaveLength(1);
    expect(api.tools[0]?.name).toBe("pi_docs_search");
    expect(api.commands.map((command) => command.name)).toContain("pi-docs");

    const sessionStart = api.handlers.get("session_start");
    if (!sessionStart) throw new Error("session_start handler was not registered");
    await sessionStart({ type: "session_start", reason: "startup" }, context());
    const tool = api.tools[0];
    if (!tool) throw new Error("pi_docs_search tool was not registered");
    const execute = tool.execute.bind(tool) as unknown as (
      ...args: unknown[]
    ) => Promise<{ content: Array<{ text: string }> }>;
    const result = await execute(
      "call-1",
      { query: "project trust", limit: 2 },
      undefined,
      undefined,
      context(),
    );
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as {
      results: Array<{ url: string; sha256: string; snippet: string }>;
    };

    expect(payload.results[0]?.url).toContain("pi.dev/docs/latest");
    expect(payload.results[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.results[0]?.snippet.length).toBeLessThanOrEqual(1200);

    const sessionShutdown = api.handlers.get("session_shutdown");
    if (!sessionShutdown) throw new Error("session_shutdown handler was not registered");
    await sessionShutdown({ type: "session_shutdown" }, context());
  });

  it("returns remediation text instead of opening a missing index", async () => {
    fixture = createIndexFixture();
    vi.stubEnv("PI_DOCS_VAULT_ROOT", `${fixture.root}-missing`);
    const api = createFakeApi();
    installExtension(api);
    const sessionStart = api.handlers.get("session_start");
    if (!sessionStart) throw new Error("session_start handler was not registered");
    await sessionStart({ type: "session_start", reason: "startup" }, context());

    const tool = api.tools[0];
    if (!tool) throw new Error("pi_docs_search tool was not registered");
    const execute = tool.execute.bind(tool) as unknown as (...args: unknown[]) => Promise<{
      content: Array<{ text: string }>;
      isError?: boolean;
    }>;
    const result = await execute("call-2", { query: "anything" }, undefined, undefined, context());

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/pi-docs build-index|index/i);
  });
});
