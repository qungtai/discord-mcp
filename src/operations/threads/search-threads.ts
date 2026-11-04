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
    "Search threads in a channel by name, tags, and time bounds. New threads take about 30 seconds to appear in search results. Returns matched threads, first messages, and member objects. Page results with offset=next_offset. To browse active threads without indexing delays, use discord_list_active_guild_threads.",
  operationIds: ["thread_search"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the parent channel to search threads in"),
    name: z.string().max(100).optional().describe("Query string to search thread names for"),
    slop: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Slop parameter controlling phrase matching fuzziness (0-100)"),
    min_id: snowflake.optional().describe("Filter threads created after this snowflake ID"),
    max_id: snowflake.optional().describe("Filter threads created before this snowflake ID"),
    // OpenAPI query arrays are style form with explode, so Discord expects one tag key per ID.
    tag: z
      .array(snowflake)
      .max(20)
      .optional()
      .describe("Filter by up to 20 forum tag IDs applied to threads"),
    tag_setting: threadTagSetting
      .optional()
      .describe(
        "How tag matches combine: 'match_all' requires a thread to have every tag in tag, 'match_some' requires at least one",
      ),
    archived: z
      .boolean()
      .optional()
      .describe("Filter by archive state: true for archived only, false for active only"),
    sort_by: z
      .enum(["relevance", "creation_time", "last_message_time", "archive_time"])
      .optional()
      .describe("Field to sort results by"),
    sort_order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Maximum number of threads to return per page (1-25)"),
    offset: z
      .number()
      .int()
      .min(0)
      .max(9975)
      .optional()
      .describe("Offset index into the search results for pagination; page with next_offset"),
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
