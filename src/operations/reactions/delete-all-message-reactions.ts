import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteAllMessageReactions = defineTool({
  name: "discord_delete_all_message_reactions",
  description: "Delete all reactions on a message",
  operationIds: ["delete_all_message_reactions"],
  toolset: "reactions",
  scope: { channel: "channel_id" },
  permissions: ["ManageMessages"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    message_id: snowflake,
  }),
  execute: async (p, { discord }) => {
    await discord<undefined>({
      method: "DELETE",
      route: Routes.channelMessageAllReactions(p.channel_id, p.message_id),
    });
    return {
      deleted: true as const,
      channel_id: p.channel_id,
      message_id: p.message_id,
    };
  },
});
