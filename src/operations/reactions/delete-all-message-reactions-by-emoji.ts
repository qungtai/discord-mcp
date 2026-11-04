import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reactionIds } from "./schemas.js";

export const deleteAllMessageReactionsByEmoji = defineTool({
  name: "discord_delete_all_message_reactions_by_emoji",
  description:
    "Delete all reactions for one specified emoji on a message across every user who reacted. To remove every emoji reaction at once, use discord_delete_all_message_reactions; to remove only the bot's own reaction, use discord_delete_my_message_reaction.",
  operationIds: ["delete_all_message_reactions_by_emoji"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory", "ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object(reactionIds),
  output: z.object({ deleted: z.literal(true), ...reactionIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageReaction(p.channel_id, p.message_id, p.emoji),
    });
    return { deleted: true as const, ...p };
  },
});
