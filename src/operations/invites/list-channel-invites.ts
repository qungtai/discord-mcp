import { type RESTGetAPIChannelInvitesResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { invite } from "./schemas.js";

export const listChannelInvites = defineTool({
  name: "discord_list_channel_invites",
  description: "Get all active invites for a channel",
  operationIds: ["list_channel_invites"],
  toolset: "invites",
  scope: { channel: "channel_id" },
  permissions: ["ManageChannels"],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
  }),
  output: z.object({
    invites: z.array(invite),
  }),
  execute: async ({ channel_id }, { discord }) => ({
    invites: await discord<RESTGetAPIChannelInvitesResult>({
      method: "GET",
      route: Routes.channelInvites(channel_id),
    }),
  }),
});
