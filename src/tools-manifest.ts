import { mkdir, writeFile } from "node:fs/promises";
import { PToolRegistry } from "./core/tool-registry.js";

const registry = await PToolRegistry.load();
const manifest = registry.list().map(({ name, toolset, operation_ids, effect, credential }) => ({
  name,
  toolset,
  operation_ids,
  effect,
  credential,
}));
await mkdir("coverage", { recursive: true });
await writeFile("coverage/tools.json", `${JSON.stringify(manifest, null, 2)}\n`);
