import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import {
  isSearchNotReady,
  type SearchNotReady,
  searchNextOffset,
  snowflake,
  threadTagSetting,
  throwSearchNotReady,
} from "../schemas.js";
import { threadList } from "./schemas.js";

export const searchThreads = defineTool({
  name: "discord_search_threads",
  description:
    "Search threads in a channel. A new thread can take about 30 seconds to appear in results. Page with offset=next_offset",
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
    // OpenAPI query arrays are style form with explode, so Discord expects one tag key per ID.
    tag: z.array(snowflake).max(20).optional(),
    tag_setting: threadTagSetting.optional(),
    archived: z.boolean().optional(),
    sort_by: z.enum(["relevance", "creation_time", "last_message_time", "archive_time"]).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(25).optional(),
    offset: z.number().int().min(0).max(9975).optional(),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) => {
    // Discord's /channels/{id}/threads/search does not have a helper in discord-api-types Routes
    const res = await discord<z.input<typeof threadList> | SearchNotReady>({
      method: "GET",
      route: `${Routes.channel(channel_id)}/threads/search`,
      query,
    });
    if (isSearchNotReady(res)) throwSearchNotReady(res);
    return {
      threads: res.threads,
      members: res.members ?? [],
      has_more: res.has_more,
      total_results: res.total_results,
      first_messages: res.first_messages,
      next_offset: searchNextOffset(query.offset, res.threads.length, res),
    };
  },
});
