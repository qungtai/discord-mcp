import { type RESTPostAPIChannelMessagesThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { autoArchiveDuration, rateLimitPerUser, reason, snowflake } from "../schemas.js";
import { thread } from "./schemas.js";

export const createThreadFromMessage = defineTool({
  name: "discord_create_thread_from_message",
  description:
    "Create a new public or announcement thread originating from an existing message in a text or announcement channel. The type of thread matches the parent channel type. Returns the created thread object. To create a standalone thread without a starter message, use discord_create_thread.",
  operationIds: ["create_thread_from_message"],
  toolset: "threads",
  scope: { channel: "channel_id", message: "message_id" },
  // ViewChannel and ReadMessageHistory are required to access the parent message.
  permissions: ["CreatePublicThreads", "ViewChannel", "ReadMessageHistory"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake.describe("ID of the parent channel containing the message"),
    message_id: snowflake.describe("ID of the message to branch the thread from"),
    name: z.string().min(1).max(100).describe("Title or name of the new thread (1-100 characters)"),
    auto_archive_duration: autoArchiveDuration
      .optional()
      .describe(
        "Duration in minutes to automatically archive thread after inactivity: 60, 1440, 4320, or 10080",
      ),
    rate_limit_per_user: rateLimitPerUser
      .optional()
      .describe("Slowmode delay per user in seconds (0-21600)"),
    reason: reason.describe("Audit log reason for creating the thread"),
  }),
  output: z.object({ thread }),
  execute: async ({ channel_id, message_id, reason: auditReason, ...body }, { discord }) => ({
    thread: await discord<RESTPostAPIChannelMessagesThreadsResult>({
      method: "POST",
      route: Routes.threads(channel_id, message_id),
      body,
      reason: auditReason,
    }),
  }),
});
