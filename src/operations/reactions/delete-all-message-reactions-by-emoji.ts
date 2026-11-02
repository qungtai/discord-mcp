import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteAllMessageReactionsByEmoji = defineTool({
  name: "discord_delete_all_message_reactions_by_emoji",
  description: "Delete all reactions for a given emoji on a message",
  operationIds: ["delete_all_message_reactions_by_emoji"],
  toolset: "reactions",
  scope: { channel: "channel_id" },
  permissions: ["ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string().min(1).describe("URL-encoded emoji (e.g. '👍' or 'name:123456789')"),
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string(),
  }),
  execute: async (p, { discord }) => {
    await discord<undefined>({
      method: "DELETE",
      route: Routes.channelMessageReaction(p.channel_id, p.message_id, p.emoji),
    });
    return {
      deleted: true as const,
      channel_id: p.channel_id,
      message_id: p.message_id,
      emoji: p.emoji,
    };
  },
});
