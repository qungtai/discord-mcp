import { type RESTGetAPITemplateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { templateResult } from "./guild-roles-schemas.js";

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
    code: z.string().min(1),
  }),
  output: templateResult,
  execute: async ({ code }, { discord }) => ({
    template: await discord<RESTGetAPITemplateResult>({
      method: "GET",
      route: Routes.template(code),
    }),
  }),
});
