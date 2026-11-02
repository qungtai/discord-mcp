import { type RESTPostAPIChannelThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { channel, reason, snowflake } from "../schemas.js";

export const createThread = defineTool({
  name: "discord_create_thread",
  description: "Create a new thread in a channel without an existing message",
  operationIds: ["create_thread"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: ["CreatePublicThreads", "CreatePrivateThreads"],
  effect: "write",
  idempotent: false,
  input: z.object({
    channel_id: snowflake,
    name: z.string().min(1).max(100),
    auto_archive_duration: z
      .union([z.literal(60), z.literal(1440), z.literal(4320), z.literal(10080)])
      .optional(),
    type: z.union([z.literal(10), z.literal(11), z.literal(12)]).optional(),
    invitable: z.boolean().optional(),
    rate_limit_per_user: z.number().int().min(0).max(21600).optional(),
    reason,
  }),
  output: z.object({ thread: channel }),
  execute: async ({ channel_id, reason: auditReason, ...body }, { discord }) => ({
    thread: await discord<RESTPostAPIChannelThreadsResult>({
      method: "POST",
      route: Routes.threads(channel_id),
      body,
      reason: auditReason,
    }),
  }),
});
