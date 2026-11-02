import { type RESTDeleteAPIGuildTemplateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateResult } from "./guild-roles-schemas.js";

export const deleteGuildTemplate = defineTool({
  name: "discord_delete_guild_template",
  description: "Delete a guild template",
  operationIds: ["delete_guild_template"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    code: z.string().min(1),
  }),
  output: templateResult,
  execute: async ({ guild_id, code }, { discord }) => ({
    template: await discord<RESTDeleteAPIGuildTemplateResult>({
      method: "DELETE",
      route: Routes.guildTemplate(guild_id, code),
    }),
  }),
});
