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
  description:
    'Search messages across a whole guild by text and filters (author, channel, mentions, attachments, links, embeds, pinned state, message ID range). Use discord_list_messages to read one channel in order. Results come back newest first by default; a page can hold fewer than limit, so page with offset=next_offset until it is null. A new or busy guild index can answer "not ready"; the tool then fails with a retryable error that carries the retry delay in seconds. Results omit reactions.',
  operationIds: ["guild_search"],
  toolset: "messages",
  scope: { guild: "guild_id", channel: "channel_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild to search messages in"),
    sort_by: sortingMode
      .optional()
      .describe(
        "Sort criterion for matching messages: 'timestamp' or 'relevance' (default 'timestamp')",
      ),
    sort_order: sortingOrder
      .optional()
      .describe(
        "Sort direction, 'asc' or 'desc' (default 'desc'). Ignored when sort_by is 'relevance'",
      ),
    content: z
      .string()
      .max(1024)
      .optional()
      .describe("Full-text query string to match inside message content"),
    slop: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Max words allowed between matching words of content (0-100, default 2)"),
    author_id: z
      .array(snowflake.describe("Author snowflake ID"))
      .max(100)
      .optional()
      .describe("Only messages from these user IDs (up to 100)"),
    author_type: z
      .array(authorType)
      .max(6)
      .optional()
      .describe(
        "Filter by author type: 'user', 'bot', 'webhook', or negated with '-' prefix (e.g. '-bot')",
      ),
    mentions: z
      .array(snowflake.describe("Mentioned user snowflake ID"))
      .max(100)
      .optional()
      .describe("Only messages that mention these user IDs (up to 100)"),
    mentions_role_id: z
      .array(snowflake.describe("Mentioned role snowflake ID"))
      .max(100)
      .optional()
      .describe("Only messages that mention these role IDs (up to 100)"),
    replied_to_user_id: z
      .array(snowflake.describe("Replied-to user snowflake ID"))
      .max(100)
      .optional()
      .describe("Only messages sent in reply to these user IDs (up to 100)"),
    replied_to_message_id: z
      .array(snowflake.describe("Replied-to message snowflake ID"))
      .max(100)
      .optional()
      .describe("Only messages replying directly to these message IDs (up to 100)"),
    mention_everyone: z
      .boolean()
      .optional()
      .describe("Filter whether the message mentions @everyone or @here"),
    min_id: snowflake
      .optional()
      .describe("Message snowflake ID floor (only messages created after this snowflake ID)"),
    max_id: snowflake
      .optional()
      .describe("Message snowflake ID ceiling (only messages created before this snowflake ID)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Max number of message results per page (1-25; default is 25)"),
    offset: z
      .number()
      .int()
      .min(0)
      .max(9975)
      .optional()
      .describe("Paging offset index into search results (use next_offset to page forward)"),
    has: z
      .array(hasOption)
      .max(18)
      .optional()
      .describe(
        "Filter by media attachment or item presence (e.g. 'link', 'embed', 'file', 'image', 'video', 'sound', 'sticker', 'poll') or negate with '-' (e.g. '-poll')",
      ),
    link_hostname: z
      .array(z.string().max(256))
      .max(100)
      .optional()
      .describe("Only messages containing links to these domains (up to 100)"),
    embed_provider: z
      .array(z.string().max(256))
      .max(100)
      .optional()
      .describe(
        "Only messages with an embed from these providers, case-sensitive, for example 'Tenor' (up to 100)",
      ),
    embed_type: z
      .array(searchableEmbedType)
      .max(5)
      .optional()
      .describe(
        "Filter messages containing specific embed types: 'image', 'video', 'gif', 'sound', 'article'",
      ),
    attachment_extension: z
      .array(z.string().max(256))
      .max(100)
      .optional()
      .describe("Filter messages by file extension on attachments (e.g. 'png', 'pdf'; up to 100)"),
    attachment_filename: z
      .array(z.string().max(1024))
      .max(100)
      .optional()
      .describe("Only messages with an attachment with one of these filenames (up to 100)"),
    pinned: z
      .boolean()
      .optional()
      .describe("Filter only pinned messages when true, or unpinned when false"),
    include_nsfw: z
      .boolean()
      .optional()
      .describe("Whether to include results from age-restricted (NSFW) channels (default false)"),
    channel_id: z
      .array(snowflake.describe("Channel snowflake ID to limit search within"))
      .max(500)
      .optional()
      .describe("Filter messages within specific channel or thread IDs (up to 500)"),
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
