import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { reactionIds } from "./schemas.js";

const userReactionIds = {
  ...reactionIds,
  user_id: snowflake,
};

export const deleteUserMessageReaction = defineTool({
  name: "discord_delete_user_message_reaction",
  description: "Delete another user's reaction from a message",
  operationIds: ["delete_user_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ManageMessages"],
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
