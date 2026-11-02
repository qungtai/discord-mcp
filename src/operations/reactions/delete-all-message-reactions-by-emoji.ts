import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reactionIds } from "./msg-reactions-schemas.js";

export const deleteAllMessageReactionsByEmoji = defineTool({
  name: "discord_delete_all_message_reactions_by_emoji",
  description: "Delete all reactions for a given emoji on a message",
  operationIds: ["delete_all_message_reactions_by_emoji"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object(reactionIds),
  output: z.object({ deleted: z.boolean(), ...reactionIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageReaction(p.channel_id, p.message_id, p.emoji),
    });
    return { deleted: true, ...p };
  },
});
