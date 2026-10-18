import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import register from "../node_modules/@juicesharp/rpiv-todo/index.ts";

export default function (pi: ExtensionAPI) {
  // L2/L3 is a work-classification policy, not a machine-detectable permission.
  register(new Proxy(pi, {
    get(target, property) {
      if (property === "registerTool") return (tool: any) => target.registerTool({
        ...tool,
        promptSnippet: "Track tasks only for justified multi-step L2/L3 work; never for L0/L1.",
        promptGuidelines: [
          "Follow the vault working-policy.md identified by the global instructions. Use todo only when an L2/L3 task benefits from visible steps; never create a board for L0/L1.",
          "Keep the list short and outcome-focused. Mark completion only after the relevant check; a checkbox is not independent verification.",
          "Task counts are not elapsed-time percentages or remaining-time estimates. Do not add speculative work."
        ]
      });
      return Reflect.get(target, property);
    }
  }));
}
