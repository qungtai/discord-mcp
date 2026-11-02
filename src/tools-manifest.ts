import { mkdir, writeFile } from "node:fs/promises";
import { PDiscordRestAdapter } from "./adapters/discord-rest/discord-rest.js";
import { PAttachmentService } from "./adapters/files/attachment-service.js";
import { PToolRegistry } from "./core/tool-registry.js";
import { registerMessageTools } from "./operations/messages/tools.js";

const registry = new PToolRegistry();
registerMessageTools(registry, new PDiscordRestAdapter(""), new PAttachmentService([], ""));
const manifest = registry.list().map(({ name, toolset, operation_ids, effect, credential }) => ({
  name,
  toolset,
  operation_ids,
  effect,
  credential,
}));
await mkdir("coverage", { recursive: true });
await writeFile("coverage/tools.json", `${JSON.stringify(manifest, null, 2)}\n`);
