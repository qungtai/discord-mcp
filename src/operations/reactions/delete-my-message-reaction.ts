import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reactionIds } from "./msg-reactions-schemas.js";

export const deleteMyMessageReaction = defineTool({
  name: "discord_delete_my_message_reaction",
  description: "Delete the current user's reaction from a message",
  operationIds: ["delete_my_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "destructive",
  // Only removes the bot's own reaction, so no approval.
  approval: false,
  idempotent: true,
  input: z.object(reactionIds),
  output: z.object({ deleted: z.boolean(), ...reactionIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageOwnReaction(p.channel_id, p.message_id, p.emoji),
    });
    return { deleted: true, ...p };
  },
});
