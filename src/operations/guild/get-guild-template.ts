import { type RESTGetAPITemplateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { templateCode, templateResult } from "./schemas.js";

export const getGuildTemplate = defineTool({
  name: "discord_get_guild_template",
  description: "Get a guild template by its code",
  operationIds: ["get_guild_template"],
  toolset: "guild",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    code: templateCode,
  }),
  output: templateResult,
  execute: async ({ code }, { discord, allowsGuild }) => {
    const template = await discord<RESTGetAPITemplateResult>({
      method: "GET",
      route: Routes.template(code),
    });
    if (!allowsGuild(template.source_guild_id)) {
      throw new PToolError("Guild is not allowed", {
        category: "policy",
        retryable: false,
        remediation: "Choose an allowed guild",
      });
    }
    return { template };
  },
});
