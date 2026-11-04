import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteAllMessageReactions = defineTool({
  name: "discord_delete_all_message_reactions",
  description:
    "Delete all reactions across all emojis and users on a single message. This permanently clears the reaction list for everyone. To remove only a single emoji type across users, use discord_delete_all_message_reactions_by_emoji; to remove only the bot's own reaction, use discord_delete_my_message_reaction.",
  operationIds: ["delete_all_message_reactions"],
  toolset: "reactions",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory", "ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the channel or thread holding the message"),
    message_id: snowflake.describe("ID of the message to clear all reactions from"),
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
  }),
  execute: async (p, { discord }) => {
    await discord({
      method: "DELETE",
      route: Routes.channelMessageAllReactions(p.channel_id, p.message_id),
    });
    return { deleted: true as const, ...p };
  },
});
