import { type RESTPostAPIChannelThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { autoArchiveDuration, rateLimitPerUser, reason, snowflake } from "../schemas.js";
import { forumInitialMessage, thread } from "./schemas.js";

export const createThread = defineTool({
  name: "discord_create_thread",
  description:
    "Create a new thread in a channel without an existing message (or start a forum post if message is provided). Defaults to private thread (type 12) if type is omitted in text channels; invitable only applies to private threads.",
  operationIds: ["create_thread"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["CreatePublicThreads", "CreatePrivateThreads"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake,
    name: z.string().min(1).max(100),
    auto_archive_duration: autoArchiveDuration.optional(),
    type: z
      .union([z.literal(10), z.literal(11), z.literal(12)])
      .optional()
      .describe(
        "Thread type: 10 (announcement), 11 (public), 12 (private). Defaults to 12 in text channels",
      ),
    invitable: z
      .boolean()
      .optional()
      .describe(
        "Whether non-moderators can invite others. Only applicable when creating a private thread (type 12)",
      ),
    rate_limit_per_user: rateLimitPerUser.optional(),
    message: forumInitialMessage
      .optional()
      .describe("Initial message required when creating a thread/post in a forum or media channel"),
    applied_tags: z
      .array(snowflake)
      .max(5)
      .optional()
      .describe("Tags to apply when creating a post in a forum or media channel"),
    reason,
  }),
  output: z.object({ thread }),
  execute: async ({ channel_id, reason: auditReason, ...body }, { discord }) => ({
    thread: await discord<RESTPostAPIChannelThreadsResult>({
      method: "POST",
      route: Routes.threads(channel_id),
      body,
      reason: auditReason,
    }),
  }),
});
