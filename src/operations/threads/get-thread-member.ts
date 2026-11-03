import { type RESTGetAPIChannelThreadMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadMember } from "./schemas.js";

export const getThreadMember = defineTool({
  name: "discord_get_thread_member",
  description: "Get a member of a thread by user ID",
  operationIds: ["get_thread_member"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    user_id: snowflake,
    with_member: z.boolean().optional(),
  }),
  output: z.object({
    member: threadMember,
  }),
  execute: async ({ channel_id, user_id, ...query }, { discord }) => ({
    member: await discord<RESTGetAPIChannelThreadMemberResult>({
      method: "GET",
      route: Routes.threadMembers(channel_id, user_id),
      query,
    }),
  }),
});
