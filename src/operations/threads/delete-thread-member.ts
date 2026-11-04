import { type RESTDeleteAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteThreadMember = defineTool({
  name: "discord_delete_thread_member",
  description:
    "Remove another user from a thread by user ID. Requires Manage Threads permissions unless the caller created the thread. To have the bot leave a thread instead, use discord_leave_thread; to add someone to a thread, use discord_add_thread_member.",
  operationIds: ["delete_thread_member"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ManageThreads"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the thread to remove the member from"),
    user_id: snowflake.describe("ID of the user to remove from the thread"),
  }),
  output: z.object({
    deleted: z.literal(true),
    channel_id: snowflake,
    user_id: snowflake,
  }),
  execute: async ({ channel_id, user_id }, { discord }) => {
    await discord<RESTDeleteAPIChannelThreadMembersResult>({
      method: "DELETE",
      route: Routes.threadMembers(channel_id, user_id),
    });
    return { deleted: true as const, channel_id, user_id };
  },
});
