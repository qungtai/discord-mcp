import { type RESTGetAPIChannelMessageReactionUsersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";
import { reactionIds } from "./schemas.js";

export const listMessageReactionsByEmoji = defineTool({
  name: "discord_list_message_reactions_by_emoji",
  description: "Get a list of users that reacted with a given emoji",
  operationIds: ["list_message_reactions_by_emoji"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...reactionIds,
    after: snowflake.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    type: z
      .union([z.literal(0), z.literal(1)])
      .optional()
      .describe("0 for normal, 1 for burst"),
  }),
  output: z.object({
    users: z.array(user),
    next_after: snowflake.nullable(),
  }),
  execute: async ({ channel_id, message_id, emoji, ...query }, { discord }) => {
    const users = await discord<RESTGetAPIChannelMessageReactionUsersResult>({
      method: "GET",
      route: Routes.channelMessageReaction(channel_id, message_id, emoji),
      query,
    });
    return {
      users,
      next_after: users.at(-1)?.id ?? null,
    };
  },
});
