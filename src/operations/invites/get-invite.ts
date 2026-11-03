import { type RESTGetAPIInviteResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { invite, inviteCode } from "./schemas.js";

export const getInvite = defineTool({
  name: "discord_get_invite",
  description:
    "Get an invite by its code. Under an allowlist, setting target_message_id requires target_channel_id so the message can be checked.",
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
    with_counts: z.boolean().optional(),
    guild_scheduled_event_id: snowflake.optional(),
    target_channel_id: snowflake.optional(),
    target_message_id: snowflake.optional(),
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
