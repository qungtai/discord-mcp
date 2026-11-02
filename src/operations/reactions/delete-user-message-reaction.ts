import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteUserMessageReaction = defineTool({
  name: "discord_delete_user_message_reaction",
  description: "Delete another user's reaction from a message",
  operationIds: ["delete_user_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id" },
  permissions: ["ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string().min(1).describe("URL-encoded emoji (e.g. '👍' or 'name:123456789')"),
    user_id: snowflake,
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string(),
    user_id: snowflake,
  }),
  execute: async (p, { discord }) => {
    await discord<undefined>({
      method: "DELETE",
      route: Routes.channelMessageUserReaction(p.channel_id, p.message_id, p.emoji, p.user_id),
    });
    return {
      deleted: true as const,
      channel_id: p.channel_id,
      message_id: p.message_id,
      emoji: p.emoji,
      user_id: p.user_id,
    };
  },
});
