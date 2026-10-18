import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  // Set before import: some upstream limits are captured at module evaluation.
  process.env.PI_BG_FEATURES = "process";
  process.env.PI_BG_DISABLE_UPDATE_CHECK = "1";
  process.env.PI_BG_DISABLE_PI_TELEMETRY = "1";
  process.env.PI_BG_SHELL = process.platform === "win32" ? "cmd" : "bash";
  process.env.PI_BG_DOCK_SHORTCUT = "ctrl+alt+b";
  const { default: register } = await import("../node_modules/pi-background-tasks/dist/extensions/background-tasks.js");
  await register(pi);
}
