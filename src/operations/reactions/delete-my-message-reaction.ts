import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteMyMessageReaction = defineTool({
  name: "discord_delete_my_message_reaction",
  description: "Delete the current user's reaction from a message",
  operationIds: ["delete_my_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "destructive",
  approval: false,
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
      route: Routes.channelMessageOwnReaction(p.channel_id, p.message_id, p.emoji),
    });
    return {
      deleted: true as const,
      channel_id: p.channel_id,
      message_id: p.message_id,
      emoji: p.emoji,
    };
  },
});
