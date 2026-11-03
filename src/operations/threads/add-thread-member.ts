import { type RESTPutAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const addThreadMember = defineTool({
  name: "discord_add_thread_member",
  description: "Add a user to a thread",
  operationIds: ["add_thread_member"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["SendMessagesInThreads"],
  effect: "write",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    user_id: snowflake,
  }),
  output: z.object({
    added: z.literal(true),
    channel_id: snowflake,
    user_id: snowflake,
  }),
  execute: async ({ channel_id, user_id }, { discord }) => {
    await discord<RESTPutAPIChannelThreadMembersResult>({
      method: "PUT",
      route: Routes.threadMembers(channel_id, user_id),
    });
    return { added: true as const, channel_id, user_id };
  },
});
