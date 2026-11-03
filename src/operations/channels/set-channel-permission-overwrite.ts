import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

const bitfield = z.string().regex(/^\d+$/, "Expected a bitfield string");

export const setChannelPermissionOverwrite = defineTool({
  name: "discord_set_channel_permission_overwrite",
  description: "Set or update permission overwrite for a channel",
  operationIds: ["set_channel_permission_overwrite"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    overwrite_id: snowflake,
    type: z.literal([0, 1]).describe("0 for role, 1 for member"),
    allow: bitfield.optional(),
    deny: bitfield.optional(),
    reason,
  }),
  output: z.object({
    channel_id: snowflake,
    overwrite_id: snowflake,
    updated: z.literal(true),
  }),
  execute: async ({ channel_id, overwrite_id, reason, ...body }, { discord }) => {
    await discord({
      method: "PUT",
      route: Routes.channelPermission(channel_id, overwrite_id),
      body,
      reason,
    });
    return { channel_id, overwrite_id, updated: true as const };
  },
});
