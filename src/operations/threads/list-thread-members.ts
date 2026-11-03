import { type RESTGetAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadMember } from "./schemas.js";

export const listThreadMembers = defineTool({
  name: "discord_list_thread_members",
  description:
    "List members of a thread. Note: after and limit pagination only apply when with_member is true and the bot has GUILD_MEMBERS intent. Page with after=next_after",
  operationIds: ["list_thread_members"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    with_member: z.boolean().optional(),
    after: snowflake.optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  output: z.object({
    members: z.array(threadMember),
    next_after: snowflake.nullable(),
  }),
  execute: async ({ channel_id, ...query }, { discord }) => {
    const members = await discord<RESTGetAPIChannelThreadMembersResult>({
      method: "GET",
      route: Routes.threadMembers(channel_id),
      query,
    });
    return {
      members,
      next_after: members.at(-1)?.user_id ?? null,
    };
  },
});
