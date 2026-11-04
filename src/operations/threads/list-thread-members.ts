import { type RESTGetAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadMember } from "./schemas.js";

export const listThreadMembers = defineTool({
  name: "discord_list_thread_members",
  description:
    "List members of a thread. Note that after and limit only apply when with_member is true, and Discord restricts this endpoint by the Server Members privileged intent. Returns thread members and next_after; page forward using after=next_after and stop when a page comes back empty. To fetch a single member, use discord_get_thread_member.",
  operationIds: ["list_thread_members"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the thread whose members to list"),
    with_member: z
      .boolean()
      .optional()
      .describe(
        "Whether to include the full guild member object for each thread member (defaults to false)",
      ),
    after: snowflake
      .optional()
      .describe(
        "User ID snowflake cursor to return thread members after; only functional when with_member is true",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Maximum number of thread members to return (1-100, defaults to 100); only functional when with_member is true",
      ),
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
