import { type RESTPatchAPIGuildTemplateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateCode, templateResult } from "./schemas.js";

export const updateGuildTemplate = defineTool({
  name: "discord_update_guild_template",
  description: "Update a guild template metadata",
  operationIds: ["update_guild_template"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    code: templateCode,
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(120).nullish(),
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
