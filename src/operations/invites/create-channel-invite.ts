import { type RESTPostAPIChannelInviteResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { invite } from "./schemas.js";

export const createChannelInvite = defineTool({
  name: "discord_create_channel_invite",
  description:
    "Create a new invite code for a guild channel. Supports setting expiration, usage limits, temporary membership, target applications or stream users, and role granting. Use discord_get_invite to inspect an existing invite or discord_list_channel_invites to view all invites for a channel. Returns the created invite object.",
  operationIds: ["create_channel_invite"],
  toolset: "invites",
  scope: { channel: "channel_id" },
  // ManageRoles is required when role_ids is supplied; ManageGuild when target_user_ids is supplied.
  permissions: ["CreateInstantInvite", "ManageRoles", "ManageGuild"],
  effect: "write",
  // role_ids grants roles to everyone who accepts the invite.
  approval: true,
  idempotent: false,
  input: z
    .object({
      channel_id: snowflake.describe("Snowflake ID of the channel to create an invite for"),
      max_age: z
        .number()
        .int()
        .min(0)
        .max(5184000)
        .optional()
        .describe(
          "Duration of invite in seconds before expiration (0 for never, up to 5184000; default 86400)",
        ),
      max_uses: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe(
          "Maximum number of times this invite can be used (0 for unlimited, up to 100; default 0)",
        ),
      temporary: z
        .boolean()
        .optional()
        .describe(
          "Whether this invite only grants temporary membership until the user disconnects",
        ),
      unique: z
        .boolean()
        .optional()
        .describe(
          "Whether to force creating a new unique invite code rather than returning an existing matching invite",
        ),
      target_type: z
        .literal([1, 2])
        .optional()
        .describe("Type of target invite: 1 for Stream, 2 for Embedded Application"),
      target_user_id: snowflake
        .optional()
        .describe(
          "Snowflake ID of the user whose stream to target (required when target_type is 1)",
        ),
      target_application_id: snowflake
        .optional()
        .describe(
          "Snowflake ID of the embedded application to open (required when target_type is 2)",
        ),
      role_ids: z
        .array(snowflake)
        .max(250)
        .optional()
        .describe("Array of up to 250 role snowflake IDs to grant to users who accept this invite"),
      target_user_ids: z
        .array(snowflake)
        .max(1000)
        .optional()
        .describe("Array of up to 1000 user snowflake IDs allowed to use this targeted invite"),
      reason: reason.describe("Reason for creating the invite in the guild audit log"),
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
