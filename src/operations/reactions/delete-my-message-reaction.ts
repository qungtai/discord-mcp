import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reactionIds } from "./schemas.js";

export const deleteMyMessageReaction = defineTool({
  name: "discord_delete_my_message_reaction",
  description:
    "Delete the bot's own reaction for a specific emoji on a message. This only removes the bot's reaction and does not affect other users. To delete another user's reaction, use discord_delete_user_message_reaction; to add a reaction, use discord_add_my_message_reaction.",
  operationIds: ["delete_my_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "destructive",
  // Only removes the bot's own reaction, so no approval.
  approval: false,
  idempotent: true,
  input: z.object(reactionIds),
  output: z.object({ deleted: z.literal(true), ...reactionIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageOwnReaction(p.channel_id, p.message_id, p.emoji),
    });
    return { deleted: true as const, ...p };
  },
});
