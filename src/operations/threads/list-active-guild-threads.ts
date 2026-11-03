import { type RESTGetAPIGuildThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./schemas.js";

export const listActiveGuildThreads = defineTool({
  name: "discord_list_active_guild_threads",
  description: "Get all active threads in a guild, including public and private threads",
  operationIds: ["get_active_guild_threads"],
  toolset: "threads",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
  }),
  output: threadList,
  execute: async ({ guild_id }, { discord }) =>
    discord<RESTGetAPIGuildThreadsResult>({
      method: "GET",
      route: Routes.guildActiveThreads(guild_id),
    }),
});
