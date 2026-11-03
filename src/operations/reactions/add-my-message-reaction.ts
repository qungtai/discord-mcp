import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reactionIds } from "./schemas.js";

export const addMyMessageReaction = defineTool({
  name: "discord_add_my_message_reaction",
  description: "Add a reaction to a message as the current user",
  operationIds: ["add_my_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  // UseExternalEmojis is required when reacting with custom emoji from other guilds.
  permissions: ["ViewChannel", "ReadMessageHistory", "AddReactions", "UseExternalEmojis"],
  effect: "write",
  idempotent: true,
  input: z.object(reactionIds),
  output: z.object({ added: z.literal(true), ...reactionIds }),
  execute: async (p, { discord }) => {
    await discord({
      method: "PUT",
      route: Routes.channelMessageOwnReaction(p.channel_id, p.message_id, p.emoji),
    });
    return { added: true as const, ...p };
  },
});
