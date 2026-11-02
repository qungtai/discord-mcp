import { type RESTPostAPIChannelInviteResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { invite } from "./schemas.js";

export const createChannelInvite = defineTool({
  name: "discord_create_channel_invite",
  description: "Create a new invite for a channel",
  operationIds: ["create_channel_invite"],
  toolset: "invites",
  scope: { channel: "channel_id" },
  permissions: ["CreateInstantInvite", "ManageRoles"],
  effect: "write",
  // role_ids grants roles to everyone who accepts the invite.
  approval: true,
  idempotent: false,
  input: z
    .object({
      channel_id: snowflake,
      max_age: z.number().int().min(0).max(5184000).optional(),
      max_uses: z.number().int().min(0).max(100).optional(),
      temporary: z.boolean().optional(),
      unique: z.boolean().optional(),
      target_type: z.literal([1, 2]).optional(),
      target_user_id: snowflake.optional(),
      target_application_id: snowflake.optional(),
      role_ids: z.array(snowflake).max(250).optional(),
      target_user_ids: z.array(snowflake).max(1000).optional(),
      reason,
    })
    .refine(
      (data) => {
        if (data.target_type === 1 && !data.target_user_id) return false;
        if (data.target_type === 2 && !data.target_application_id) return false;
        return true;
      },
      {
        message:
          "target_user_id is required when target_type is 1; target_application_id is required when target_type is 2",
      },
    ),
  output: z.object({
    invite,
  }),
  execute: async ({ channel_id, reason, ...body }, { discord }) => ({
    invite: await discord<RESTPostAPIChannelInviteResult>({
      method: "POST",
      route: Routes.channelInvites(channel_id),
      body,
      reason,
    }),
  }),
});
