import { type RESTDeleteAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const leaveThread = defineTool({
  name: "discord_leave_thread",
  description:
    "Remove the bot user from a thread. If the thread is private, the bot must be re-added or reinvited to rejoin. To join a thread, use discord_join_thread; to remove another user, use discord_delete_thread_member.",
  operationIds: ["leave_thread"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "destructive",
  approval: false, // Safe without approval because it removes only the bot's own membership of a public thread; private threads need a new invite to rejoin
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the thread to leave"),
  }),
  output: z.object({
    left: z.literal(true),
    channel_id: snowflake,
  }),
  execute: async ({ channel_id }, { discord }) => {
    await discord<RESTDeleteAPIChannelThreadMembersResult>({
      method: "DELETE",
      route: Routes.threadMembers(channel_id, "@me"),
    });
    return { left: true as const, channel_id };
  },
});
