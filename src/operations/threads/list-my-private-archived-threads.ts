import { type RESTGetAPIChannelUsersThreadsArchivedResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./msg-threads-schemas.js";

export const listMyPrivateArchivedThreads = defineTool({
  name: "discord_list_my_private_archived_threads",
  description: "List private archived threads that the bot has joined in a channel",
  operationIds: ["list_my_private_archived_threads"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    before: snowflake.optional().describe("Thread ID to return threads before"),
    limit: z.number().int().min(2).max(100).optional(),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) =>
    discord<RESTGetAPIChannelUsersThreadsArchivedResult>({
      method: "GET",
      route: Routes.channelJoinedArchivedThreads(channel_id),
      query,
    }),
});
