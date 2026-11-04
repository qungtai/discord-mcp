import { type RESTPutAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const addThreadMember = defineTool({
  name: "discord_add_thread_member",
  description:
    "Add another user to a thread by user ID. The thread must not be archived, and the call succeeds without change if the user is already a member. To have the bot join a thread instead, use discord_join_thread; to remove a member, use discord_delete_thread_member.",
  operationIds: ["add_thread_member"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["SendMessagesInThreads"],
  effect: "write",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the thread to add the member to"),
    user_id: snowflake.describe("ID of the user to add to the thread"),
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
