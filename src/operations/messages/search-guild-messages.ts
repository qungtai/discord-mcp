import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { channel, member, message, snowflake } from "../schemas.js";

const sortingMode = z.enum(["relevance", "timestamp"]);
const sortingOrder = z.enum(["asc", "desc"]);
const authorType = z.enum(["user", "bot", "webhook", "-user", "-bot", "-webhook"]);
const hasOption = z.enum([
  "link",
  "embed",
  "file",
  "image",
  "video",
  "sound",
  "sticker",
  "poll",
  "snapshot",
  "-link",
  "-embed",
  "-file",
  "-image",
  "-video",
  "-sound",
  "-sticker",
  "-poll",
  "-snapshot",
]);
const searchableEmbedType = z.enum(["image", "video", "gif", "sound", "article"]);

const outputSchema = z.object({
  messages: z.array(z.array(message)),
  total_results: z.number().int(),
  threads: z.array(channel).nullish(),
  members: z.array(member).nullish(),
  doing_deep_historical_index: z.boolean().optional(),
  documents_indexed: z.number().int().nullish(),
});
type GuildSearchOutput = z.input<typeof outputSchema>;

interface SearchIndexNotReady {
  message?: string;
  code?: number;
  documents_indexed?: number;
  retry_after?: number;
}

export const searchGuildMessages = defineTool({
  name: "discord_search_guild_messages",
  description: "Search messages across a guild",
  operationIds: ["guild_search"],
  toolset: "messages",
  scope: { guild: "guild_id", channel: "channel_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    sort_by: sortingMode.optional(),
    sort_order: sortingOrder.optional(),
    content: z.string().max(1024).optional(),
    slop: z.number().int().min(0).max(100).optional(),
    author_id: z.array(snowflake).max(100).optional(),
    author_type: z.array(authorType).max(6).optional(),
    mentions: z.array(snowflake).max(100).optional(),
    mentions_role_id: z.array(snowflake).max(100).optional(),
    replied_to_user_id: z.array(snowflake).max(100).optional(),
    replied_to_message_id: z.array(snowflake).max(100).optional(),
    mention_everyone: z.boolean().optional(),
    min_id: snowflake.optional(),
    max_id: snowflake.optional(),
    limit: z.number().int().min(1).max(25).optional(),
    offset: z.number().int().min(0).max(9975).optional(),
    has: z.array(hasOption).max(18).optional(),
    link_hostname: z.array(z.string().max(256)).max(100).optional(),
    embed_provider: z.array(z.string().max(256)).max(100).optional(),
    embed_type: z.array(searchableEmbedType).max(5).optional(),
    attachment_extension: z.array(z.string().max(256)).max(100).optional(),
    attachment_filename: z.array(z.string().max(1024)).max(100).optional(),
    pinned: z.boolean().optional(),
    include_nsfw: z.boolean().optional(),
    channel_id: z.array(snowflake).max(500).optional(),
  }),
  output: outputSchema,
  execute: async ({ guild_id, ...query }, { discord }) => {
    const response = await discord<GuildSearchOutput | SearchIndexNotReady>({
      method: "GET",
      route: Routes.guildMessagesSearch(guild_id),
      query,
    });
    if (!("total_results" in response)) {
      throw new PToolError("Search index is not ready", {
        category: "rate_limited",
        retryable: true,
        retryAfter: response.retry_after,
        remediation: "The search index is still being built; retry after retry_after seconds",
      });
    }
    return response;
  },
});
