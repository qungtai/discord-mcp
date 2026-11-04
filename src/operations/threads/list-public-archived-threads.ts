import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./schemas.js";

export const listPublicArchivedThreads = defineTool({
  name: "discord_list_public_archived_threads",
  description:
    "List public archived threads in a channel. Returns thread objects, thread member entries, and a next_before cursor. Page older threads in descending order by archive timestamp using before=next_before. To list private archived threads instead, use discord_list_private_archived_threads.",
  operationIds: ["list_public_archived_threads"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe(
      "ID of the parent channel containing the public archived threads",
    ),
    before: z
      .string()
      .optional()
      .describe(
        "ISO 8601 timestamp cursor to return threads archived before this time; page with next_before",
      ),
    limit: z
      .number()
      .int()
      .min(2)
      .max(100)
      .optional()
      .describe("Maximum number of threads to return (2-100)"),
  }),
  output: threadList,
  execute: async ({ channel_id, ...query }, { discord }) => {
    const res = await discord<z.infer<typeof threadList>>({
      method: "GET",
      route: Routes.channelThreads(channel_id, "public"),
      query,
    });
    const lastArchive = res.threads.at(-1)?.thread_metadata?.archive_timestamp;
    return {
      ...res,
      next_before: res.has_more && lastArchive ? lastArchive : null,
    };
  },
});
