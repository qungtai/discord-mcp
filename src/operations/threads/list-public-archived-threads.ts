import { type RESTGetAPIChannelThreadsArchivedPublicResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./msg-threads-schemas.js";

export const listPublicArchivedThreads = defineTool({
  name: "discord_list_public_archived_threads",
  description: "List public archived threads in a channel",
  operationIds: ["list_public_archived_threads"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    before: z.string().optional().describe("ISO8601 timestamp to return threads before"),
    limit: z.number().int().min(2).max(100).optional(),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) =>
    discord<RESTGetAPIChannelThreadsArchivedPublicResult>({
      method: "GET",
      route: Routes.channelThreads(channel_id, "public"),
      query,
    }),
});
