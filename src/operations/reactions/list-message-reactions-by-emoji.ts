import { type RESTGetAPIChannelMessageReactionUsersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";

export const listMessageReactionsByEmoji = defineTool({
  name: "discord_list_message_reactions_by_emoji",
  description: "Get a list of users that reacted with a given emoji",
  operationIds: ["list_message_reactions_by_emoji"],
  toolset: "reactions",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string().min(1).describe("URL-encoded emoji (e.g. '👍' or 'name:123456789')"),
    after: snowflake.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    type: z.number().int().optional().describe("0 for normal, 1 for burst"),
  }),
  output: z.object({
    users: z.array(user),
    next_after: snowflake.optional(),
  }),
  execute: async ({ channel_id, message_id, emoji, ...query }, { discord }) => {
    const users = await discord<RESTGetAPIChannelMessageReactionUsersResult>({
      method: "GET",
      route: Routes.channelMessageReaction(channel_id, message_id, emoji),
      query,
    });
    const last = users.at(-1);
    return {
      users,
      next_after: last?.id,
    };
  },
});
