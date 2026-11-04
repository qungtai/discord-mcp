import { type RESTDeleteAPIGuildTemplateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateCode, templateResult } from "./schemas.js";

export const deleteGuildTemplate = defineTool({
  name: "discord_delete_guild_template",
  description:
    "Delete a template from a guild by template code. Because Discord allows only one template per guild, deleting the existing template permits creating a new snapshot. To inspect the template before deleting use discord_get_guild_template. Returns the deleted template object.",
  operationIds: ["delete_guild_template"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild that owns the template (numeric snowflake string)",
    ),
    code: templateCode,
  }),
  output: templateResult,
  execute: async ({ guild_id, code }, { discord }) => ({
    template: await discord<RESTDeleteAPIGuildTemplateResult>({
      method: "DELETE",
      route: Routes.guildTemplate(guild_id, code),
    }),
  }),
});
