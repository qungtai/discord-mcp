import { type RESTGetAPIGuildTemplatesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templatesResult } from "./guild-roles-schemas.js";

export const listGuildTemplates = defineTool({
  name: "discord_list_guild_templates",
  description: "List templates for a guild",
  operationIds: ["list_guild_templates"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
  }),
  output: templatesResult,
  execute: async ({ guild_id }, { discord }) => ({
    templates: await discord<RESTGetAPIGuildTemplatesResult>({
      method: "GET",
      route: Routes.guildTemplates(guild_id),
    }),
  }),
});
