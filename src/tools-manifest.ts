import { mkdir, writeFile } from "node:fs/promises";
import { PToolRegistry } from "./core/tool-registry.js";

const registry = await PToolRegistry.load();
const manifest = registry.list().map((t) => ({
  name: t.name,
  toolset: t.toolset,
  operation_ids: t.operation_ids,
  effect: t.effect,
  credential: t.credential,
  permissions: t.permissions,
}));
await mkdir("coverage", { recursive: true });
await writeFile("coverage/tools.json", `${JSON.stringify(manifest, null, 2)}\n`);
