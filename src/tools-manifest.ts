import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
// @ts-expect-error script module imported in build tool
import { syncRegister } from "../scripts/coverage/sync.mjs";
import { PToolRegistry } from "./core/tool-registry.js";

const registry = await PToolRegistry.load();
const manifest = registry.list().map((t) => ({
  name: t.name,
  toolset: t.toolset,
  operation_ids: t.operationIds,
  effect: t.effect,
  approval: t.approval,
  credential: t.credential,
  permissions: t.permissions,
}));

await mkdir("coverage", { recursive: true });
await writeFile("coverage/tools.json", `${JSON.stringify(manifest, null, 2)}\n`);

const registerPath = join("coverage", "register.json");
const evidencePath = join("coverage", "live-evidence.json");

if (existsSync(registerPath)) {
  const register = JSON.parse(await readFile(registerPath, "utf8"));
  let evidence = null;
  if (existsSync(evidencePath)) {
    evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  }
  const updatedRegister = syncRegister(register, manifest, evidence);
  await writeFile(registerPath, `${JSON.stringify(updatedRegister, null, 2)}\n`);
}
