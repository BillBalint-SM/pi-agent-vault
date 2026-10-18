import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { localPath } from "../lib/runtime.ts";

export default async function (pi: ExtensionAPI) {
  process.env.PI_ALLOW_BROWSER_COOKIES = "0";
  process.env.PI_WEB_ACCESS_CACHE_ROOT = localPath("runtime/web");
  const { default: register } = await import("../node_modules/pi-web-access/dist/index.js");
  await register(new Proxy(pi, {
    get(target, property) {
      if (property === "registerTool") return (tool: any) => target.registerTool(tool.name === "web_search" ? {
        ...tool,
        execute(id: string, args: any, ...rest: any[]) {
          // No hidden summary-model calls or curator/browser launch.
          return tool.execute(id, { ...args, workflow: "none" }, ...rest);
        }
      } : tool);
      return Reflect.get(target, property);
    }
  }));
}
