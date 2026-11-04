import { type RESTPutAPIGuildTemplateSyncResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateCode, templateResult } from "./schemas.js";

export const syncGuildTemplate = defineTool({
  name: "discord_sync_guild_template",
  description:
    "Synchronize an existing template with the current state and structure of the guild. A guild can have at most one template; when the source guild changes, the template becomes out of sync until updated here. To view or check template dirty state use discord_list_guild_templates. Returns the updated template object.",
  operationIds: ["sync_guild_template"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe(
      "ID of the guild whose template to sync (numeric snowflake string)",
    ),
    code: templateCode,
  }),
  output: templateResult,
  execute: async ({ guild_id, code }, { discord }) => ({
    template: await discord<RESTPutAPIGuildTemplateSyncResult>({
      method: "PUT",
      route: Routes.guildTemplate(guild_id, code),
    }),
  }),
});
