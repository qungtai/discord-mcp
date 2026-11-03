import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageIds } from "../messages/schemas.js";

export const deleteAllMessageReactions = defineTool({
  name: "discord_delete_all_message_reactions",
  description: "Delete all reactions on a message",
  operationIds: ["delete_all_message_reactions"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory", "ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object(messageIds),
  output: z.object({ deleted: z.literal(true), ...messageIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageAllReactions(p.channel_id, p.message_id),
    });
    return { deleted: true as const, ...p };
  },
});
