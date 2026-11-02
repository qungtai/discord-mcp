import { type RESTGetAPIChannelThreadsArchivedPrivateResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./msg-threads-schemas.js";

export const listPrivateArchivedThreads = defineTool({
  name: "discord_list_private_archived_threads",
  description: "List private archived threads in a channel",
  operationIds: ["list_private_archived_threads"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory", "ManageThreads"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    before: z.string().optional().describe("ISO8601 timestamp to return threads before"),
    limit: z.number().int().min(2).max(100).optional(),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) =>
    discord<RESTGetAPIChannelThreadsArchivedPrivateResult>({
      method: "GET",
      route: Routes.channelThreads(channel_id, "private"),
      query,
    }),
});
