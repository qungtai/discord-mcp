import { type RESTPostAPIChannelThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { autoArchiveDuration, rateLimitPerUser, reason, snowflake } from "../schemas.js";
import { forumInitialMessage, thread } from "./schemas.js";

export const createThread = defineTool({
  name: "discord_create_thread",
  description:
    "Create a new thread without a starter message, or start a new forum or media channel post. Announcement threads (type 10) broadcast across servers, public threads (11) are visible to everyone with channel access, and private threads (12) restrict access to explicitly invited members. In forum or media channels, provide message to create the initial post.",
  operationIds: ["create_thread"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  // SendMessages, ViewChannel, and EmbedLinks are required when posting in forum or media channels.
  permissions: [
    "CreatePublicThreads",
    "CreatePrivateThreads",
    "SendMessages",
    "ViewChannel",
    "EmbedLinks",
  ],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake.describe(
      "ID of the parent channel (text, announcement, forum, or media)",
    ),
    name: z.string().min(1).max(100).describe("Title or name of the new thread (1-100 characters)"),
    auto_archive_duration: autoArchiveDuration
      .optional()
      .describe(
        "Duration in minutes to automatically archive thread after inactivity: 60, 1440, 4320, or 10080",
      ),
    type: z
      .union([z.literal(10), z.literal(11), z.literal(12)])
      .optional()
      .describe(
        "Thread type: 10 (announcement thread in announcement channel), 11 (public thread in text channel), or 12 (private thread in text channel; default in text channels)",
      ),
    invitable: z
      .boolean()
      .optional()
      .describe(
        "Whether non-moderator members can invite others to the thread; only applicable to private threads (type 12)",
      ),
    rate_limit_per_user: rateLimitPerUser
      .optional()
      .describe("Slowmode delay per user in seconds (0-21600)"),
    message: forumInitialMessage
      .optional()
      .describe(
        "Contents of the first post or message; required when creating a post in a forum or media channel",
      ),
    applied_tags: z
      .array(snowflake)
      .max(5)
      .optional()
      .describe(
        "IDs of up to 5 forum tags to apply when creating a post in a forum or media channel",
      ),
    reason: reason.describe("Audit log reason for creating the thread"),
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
