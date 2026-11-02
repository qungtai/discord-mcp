import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./msg-threads-schemas.js";

export const threadSearch = defineTool({
  name: "discord_thread_search",
  description: "Search threads in a channel",
  operationIds: ["thread_search"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    name: z.string().max(100).optional(),
    slop: z.number().int().min(0).max(100).optional(),
    min_id: snowflake.optional(),
    max_id: snowflake.optional(),
    tag: snowflake.optional(),
    tag_setting: z.enum(["match_all", "match_some"]).optional(),
    archived: z.boolean().optional(),
    sort_by: z.enum(["relevance", "creation_time", "last_message_time", "archive_time"]).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(25).optional(),
    offset: z.number().int().min(0).max(9975).optional(),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) =>
    discord({
      method: "GET",
      route: `${Routes.channel(channel_id)}/threads/search`,
      query,
    }),
});
