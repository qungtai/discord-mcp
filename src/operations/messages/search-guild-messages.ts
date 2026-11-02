import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import {
  channel,
  isSearchNotReady,
  message,
  type SearchNotReady,
  searchNextOffset,
  snowflake,
  throwSearchNotReady,
} from "../schemas.js";
import { threadMember } from "../threads/schemas.js";

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
  members: z.array(threadMember).nullish(),
  doing_deep_historical_index: z.boolean().optional(),
  documents_indexed: z.number().int().nullish(),
  next_offset: z.number().int().nullable(),
});
type GuildSearchOutput = z.input<typeof outputSchema>;

export const searchGuildMessages = defineTool({
  name: "discord_search_guild_messages",
  description: "Search messages across a guild. Page with offset=next_offset",
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
    const response = await discord<Omit<GuildSearchOutput, "next_offset"> | SearchNotReady>({
      method: "GET",
      route: Routes.guildMessagesSearch(guild_id),
      query,
    });
    if (isSearchNotReady(response)) throwSearchNotReady(response);
    return {
      ...response,
      next_offset: searchNextOffset(query.offset, response.messages?.length ?? 0, response),
    };
  },
});
