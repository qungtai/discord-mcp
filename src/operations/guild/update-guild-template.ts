import { type RESTPatchAPIGuildTemplateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateCode, templateResult } from "./schemas.js";

export const updateGuildTemplate = defineTool({
  name: "discord_update_guild_template",
  description:
    "Update name and description metadata for an existing guild template. Each guild supports only one template; updating metadata does not sync channels or roles. To synchronize template structure with server changes use discord_sync_guild_template. Returns the updated template object.",
  operationIds: ["update_guild_template"],
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
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe("New name for the template (1-100 characters)"),
    description: z
      .string()
      .max(120)
      .nullish()
      .describe("New description for the template (up to 120 characters)"),
  }),
  output: templateResult,
  execute: async ({ guild_id, code, ...body }, { discord }) => ({
    template: await discord<RESTPatchAPIGuildTemplateResult>({
      method: "PATCH",
      route: Routes.guildTemplate(guild_id, code),
      body,
    }),
  }),
});
