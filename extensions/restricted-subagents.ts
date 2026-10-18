import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hostRoot, localPath } from "../lib/runtime.ts";

export default async function (pi: ExtensionAPI) {
  process.env.PI_SUBAGENTS_TEMP_ROOT = localPath("runtime/subagents");
  process.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT = hostRoot();
  const { registerSubagentCapabilityCeiling } = await import("../node_modules/pi-subagents/src/api/capability-ceiling.js");
  let restriction: { dispose(): void } | undefined;
  // Registered before the upstream session_start handler, so discovery sees the ceiling.
  pi.on("session_start", (_event, ctx) => {
    restriction?.dispose();
    restriction = registerSubagentCapabilityCeiling({
      sessionId: ctx.sessionManager.getSessionId(),
      source: "pi-operator-readonly",
      ceiling: {
        allowedAgents: ["pi-reviewer"],
        allowedTools: ["read", "grep", "find", "ls"],
        denyExtensions: true
      }
    });
  });
  pi.on("session_shutdown", () => {
    restriction?.dispose();
    restriction = undefined;
  });
  const { default: register } = await import("../node_modules/pi-subagents/index.js");
  await register(pi);
}
