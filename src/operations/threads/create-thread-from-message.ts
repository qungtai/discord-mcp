import { type RESTPostAPIChannelMessagesThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { autoArchiveDuration, rateLimitPerUser, reason, snowflake } from "../schemas.js";
import { thread } from "./msg-threads-schemas.js";

export const createThreadFromMessage = defineTool({
  name: "discord_create_thread_from_message",
  description: "Create a new thread from an existing message in a channel",
  operationIds: ["create_thread_from_message"],
  toolset: "threads",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["CreatePublicThreads"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
    name: z.string().min(1).max(100),
    auto_archive_duration: autoArchiveDuration.optional(),
    rate_limit_per_user: rateLimitPerUser.optional(),
    reason,
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
