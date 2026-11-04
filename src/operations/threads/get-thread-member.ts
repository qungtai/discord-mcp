import { type RESTGetAPIChannelThreadMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadMember } from "./schemas.js";

export const getThreadMember = defineTool({
  name: "discord_get_thread_member",
  description:
    "Fetch membership details for one user in a thread, including their join timestamp and flags. Fails with 404 if the user is not a member. Set with_member to true to include full guild member details. To list all members of a thread, use discord_list_thread_members.",
  operationIds: ["get_thread_member"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("ID of the thread to look up membership in"),
    user_id: snowflake.describe("ID of the user whose thread membership to check"),
    with_member: z
      .boolean()
      .optional()
      .describe(
        "Whether to include the full guild member object in the result (defaults to false)",
      ),
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
