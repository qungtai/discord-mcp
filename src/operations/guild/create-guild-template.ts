import { type RESTPostAPIGuildTemplatesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateResult } from "./schemas.js";

export const createGuildTemplate = defineTool({
  name: "discord_create_guild_template",
  description:
    "Create a new template from an existing guild snapshot. Discord permits only one template per guild; creating another fails unless the existing one is deleted. To list existing templates use discord_list_guild_templates. Returns the created template object including its unique code.",
  operationIds: ["create_guild_template"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake.describe("ID of the source guild to snapshot (numeric snowflake string)"),
    name: z.string().min(1).max(100).describe("Name for the template (1-100 characters)"),
    description: z
      .string()
      .max(120)
      .nullish()
      .describe("Optional template description (up to 120 characters)"),
  }),
  output: templateResult,
  execute: async ({ guild_id, ...body }, { discord }) => ({
    template: await discord<RESTPostAPIGuildTemplatesResult>({
      method: "POST",
      route: Routes.guildTemplates(guild_id),
      body,
    }),
  }),
});
