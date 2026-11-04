import { type RESTGetAPIInviteResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { invite, inviteCode } from "./schemas.js";

export const getInvite = defineTool({
  name: "discord_get_invite",
  description:
    "Fetch invite metadata by invite code, optionally including member and online presence counts. Under a guild allowlist, setting target_message_id requires target_channel_id so message access can be validated. Use discord_delete_invite to revoke an invite. Returns the invite object with channel, guild, and expiration details.",
  operationIds: ["invite_resolve"],
  toolset: "invites",
  scope: {
    invite: "code",
    channel: "target_channel_id",
    message: "target_message_id",
  },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    with_counts: z
      .boolean()
      .optional()
      .describe("Whether to include approximate_member_count and approximate_presence_count"),
    guild_scheduled_event_id: snowflake
      .optional()
      .describe("Snowflake ID of a scheduled event to include in the invite representation"),
    target_channel_id: snowflake
      .optional()
      .describe(
        "Snowflake ID of the channel containing the target message (required with target_message_id under allowlist)",
      ),
    target_message_id: snowflake
      .optional()
      .describe("Snowflake ID of the message linked to this invite"),
  }),
  output: z.object({
    invite,
  }),
  execute: async ({ code, ...query }, { discord }) => ({
    invite: await discord<RESTGetAPIInviteResult>({
      method: "GET",
      route: Routes.invite(encodeURIComponent(code)),
      query,
    }),
  }),
});
