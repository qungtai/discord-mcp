import { type RESTGetAPIChannelUsersThreadsArchivedResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./schemas.js";

export const listMyPrivateArchivedThreads = defineTool({
  name: "discord_list_my_private_archived_threads",
  description:
    "List private archived threads within a channel that the bot user has joined. Returns thread objects, thread member entries, and a next_before cursor. Page older threads in descending order using before=next_before. To list all private archived threads in the channel regardless of bot participation, use discord_list_private_archived_threads.",
  operationIds: ["list_my_private_archived_threads"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe(
      "ID of the parent channel to list joined private archived threads from",
    ),
    before: snowflake
      .optional()
      .describe(
        "Thread ID snowflake cursor to return threads created before; page with next_before",
      ),
    limit: z
      .number()
      .int()
      .min(2)
      .max(100)
      .optional()
      .describe("Maximum number of threads to return (2-100, defaults to 50)"),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) => {
    const res = await discord<RESTGetAPIChannelUsersThreadsArchivedResult>({
      method: "GET",
      route: Routes.channelJoinedArchivedThreads(channel_id),
      query,
    });
    return {
      ...res,
      next_before: res.has_more ? (res.threads.at(-1)?.id ?? null) : null,
    };
  },
});
