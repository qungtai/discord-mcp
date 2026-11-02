import { type RESTPutAPIChannelThreadMembersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const joinThread = defineTool({
  name: "discord_join_thread",
  description: "Add the current user to a thread",
  operationIds: ["join_thread"],
  toolset: "threads",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "write",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
  }),
  output: z.object({
    joined: z.literal(true),
    channel_id: snowflake,
  }),
  execute: async ({ channel_id }, { discord }) => {
    await discord<RESTPutAPIChannelThreadMembersResult>({
      method: "PUT",
      route: `${Routes.threadMembers(channel_id)}/@me`,
    });
    return { joined: true as const, channel_id };
  },
});
