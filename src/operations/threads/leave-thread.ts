import { type RESTDeleteAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const leaveThread = defineTool({
  name: "discord_leave_thread",
  description: "Remove the current user from a thread",
  operationIds: ["leave_thread"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "destructive",
  approval: false, // Leaving a thread as the bot itself does not destroy external resources
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
  }),
  output: z.object({
    left: z.literal(true),
    channel_id: snowflake,
  }),
  execute: async ({ channel_id }, { discord }) => {
    await discord<RESTDeleteAPIChannelThreadMembersResult>({
      method: "DELETE",
      route: `${Routes.threadMembers(channel_id)}/@me`,
    });
    return { left: true as const, channel_id };
  },
});
