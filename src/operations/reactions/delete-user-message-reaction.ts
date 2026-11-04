import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { reactionIds } from "./schemas.js";

const userReactionIds = {
  ...reactionIds,
  user_id: snowflake.describe("ID of the user whose reaction is being removed"),
};

export const deleteUserMessageReaction = defineTool({
  name: "discord_delete_user_message_reaction",
  description:
    "Delete another user's reaction for a specific emoji on a message. This removes only the target user's reaction, leaving all other reactions untouched. To remove the bot's own reaction without moderation permissions, use discord_delete_my_message_reaction; to remove all reactions of this emoji, use discord_delete_all_message_reactions_by_emoji.",
  operationIds: ["delete_user_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory", "ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object(userReactionIds),
  output: z.object({ deleted: z.literal(true), ...userReactionIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageUserReaction(p.channel_id, p.message_id, p.emoji, p.user_id),
    });
    return { deleted: true as const, ...p };
  },
});
