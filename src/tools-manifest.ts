import { mkdir, writeFile } from "node:fs/promises";
import { PToolRegistry } from "./core/tool-registry.js";
import { registerMessageTools } from "./operations/messages/tools.js";

const registry = new PToolRegistry();
registerMessageTools(registry);
const manifest = registry.list().map(({ name, toolset, operation_ids, effect, credential }) => ({
  name,
  toolset,
  operation_ids,
  effect,
  credential,
}));
await mkdir("coverage", { recursive: true });
await writeFile("coverage/tools.json", `${JSON.stringify(manifest, null, 2)}\n`);
