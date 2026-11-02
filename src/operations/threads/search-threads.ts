import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./msg-threads-schemas.js";

// Discord search response or 202 SearchIndexNotReady response
interface RawThreadSearchResponse {
  threads?: unknown[];
  members?: unknown[];
  has_more?: boolean;
  total_results?: number;
  first_messages?: unknown[];
  code?: number;
  message?: string;
  retry_after?: number;
}

export const searchThreads = defineTool({
  name: "discord_search_threads",
  description: "Search threads in a channel. Page with offset=next_offset",
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
    tag: snowflake
      .optional()
      .describe("Thread tag ID. Note: multi-tag search requires core array query support"),
    tag_setting: z.enum(["match_all", "match_some"]).optional(),
    archived: z.boolean().optional(),
    sort_by: z.enum(["relevance", "creation_time", "last_message_time", "archive_time"]).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(25).optional(),
    offset: z.number().int().min(0).max(9975).optional(),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) => {
    // Discord's /channels/{id}/threads/search does not have a helper in discord-api-types Routes
    const res = await discord<RawThreadSearchResponse>({
      method: "GET",
      route: `${Routes.channel(channel_id)}/threads/search`,
      query,
    });

    if (!res.threads) {
      const retryAfter = res.retry_after ?? 5;
      throw new PToolError(res.message ?? "Search index is not ready yet", {
        category: "rate_limited",
        retryable: true,
        remediation: `Index not ready, retry after ${retryAfter} seconds`,
        retryAfter,
        discordCode: res.code,
      });
    }

    const threads = res.threads ?? [];
    const hasMore = Boolean(res.has_more);
    const nextOffset = hasMore ? (query.offset ?? 0) + threads.length : null;

    return {
      threads: threads as z.infer<typeof threadList>["threads"],
      members: (res.members ?? []) as z.infer<typeof threadList>["members"],
      has_more: res.has_more,
      total_results: res.total_results,
      first_messages: res.first_messages as z.infer<typeof threadList>["first_messages"],
      next_offset: nextOffset,
    };
  },
});
