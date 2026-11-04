import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const updateVoiceChannelStatus = defineTool({
  name: "discord_update_voice_channel_status",
  description:
    "Set or clear the status topic displayed in a voice or stage channel. Pass a string of up to 500 characters to update the status, or null to clear it. Use discord_get_channel to inspect current channel metadata. Returns the updated status string and channel ID.",
  operationIds: ["update_voice_channel_status"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["SetVoiceChannelStatus", "Connect"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    channel_id: snowflake.describe("Snowflake ID of the voice or stage channel to update"),
    status: z
      .string()
      .max(500)
      .nullable()
      .describe("Status text to set for the voice channel (0-500 characters), or null to clear"),
  }),
  output: z.object({
    channel_id: snowflake,
    status: z.string().nullable(),
    updated: z.literal(true),
  }),
  execute: async ({ channel_id, status }, { discord }) => {
    await discord({
      method: "PUT",
      route: Routes.channelVoiceStatus(channel_id),
      body: { status },
    });
    return { channel_id, status, updated: true as const };
  },
});
