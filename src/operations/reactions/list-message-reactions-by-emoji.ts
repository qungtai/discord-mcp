import { type RESTGetAPIChannelMessageReactionUsersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";
import { reactionIds } from "./schemas.js";

export const listMessageReactionsByEmoji = defineTool({
  name: "discord_list_message_reactions_by_emoji",
  description:
    "List users who reacted with a specific emoji on a message. Returns an array of user objects and a next_after cursor. Page older reactions in ascending order using after=next_after. To add the bot's reaction, use discord_add_my_message_reaction.",
  operationIds: ["list_message_reactions_by_emoji"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...reactionIds,
    after: snowflake.optional().describe("Get users after this user ID for forward pagination"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of users to return (1-100, defaults to 25)"),
    type: z
      .union([z.literal(0), z.literal(1)])
      .optional()
      .describe(
        "Reaction type filter: 0 for normal reactions, 1 for burst (super) reactions (defaults to 0)",
      ),
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
