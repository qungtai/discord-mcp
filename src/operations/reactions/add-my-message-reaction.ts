import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const addMyMessageReaction = defineTool({
  name: "discord_add_my_message_reaction",
  description: "Add a reaction to a message as the current user",
  operationIds: ["add_my_message_reaction"],
  toolset: "reactions",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory", "AddReactions"],
  effect: "write",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string().min(1).describe("URL-encoded emoji (e.g. '👍' or 'name:123456789')"),
  }),
  output: z.object({
    added: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
    emoji: z.string(),
  }),
  execute: async (p, { discord }) => {
    await discord<undefined>({
      method: "PUT",
      route: Routes.channelMessageOwnReaction(p.channel_id, p.message_id, p.emoji),
    });
    return {
      added: true as const,
      channel_id: p.channel_id,
      message_id: p.message_id,
      emoji: p.emoji,
    };
  },
});
