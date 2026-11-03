import { type RESTPostAPIGuildTemplatesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { templateResult } from "./template-schemas.js";

export const createGuildTemplate = defineTool({
  name: "discord_create_guild_template",
  description: "Create a template for a guild",
  operationIds: ["create_guild_template"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake,
    name: z.string().min(1).max(100),
    description: z.string().max(120).nullish(),
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
