import { type RESTGetAPIGuildTemplatesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templatesResult } from "./schemas.js";

export const listGuildTemplates = defineTool({
  name: "discord_list_guild_templates",
  description:
    "List templates created for a specific guild. Because Discord enforces a limit of one template per guild, this endpoint returns an array containing at most one template. To sync a template after guild changes use discord_sync_guild_template, or to create one use discord_create_guild_template. Returns the list of template objects.",
  operationIds: ["list_guild_templates"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild whose templates to list (numeric snowflake string)",
    ),
  }),
  output: templatesResult,
  execute: async ({ guild_id }, { discord }) => ({
    templates: await discord<RESTGetAPIGuildTemplatesResult>({
      method: "GET",
      route: Routes.guildTemplates(guild_id),
    }),
  }),
});
