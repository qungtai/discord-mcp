import { type RESTDeleteAPIInviteResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason } from "../schemas.js";
import { invite, inviteCode } from "./schemas.js";

export const deleteInvite = defineTool({
  name: "discord_delete_invite",
  description:
    "Permanently delete and revoke an invite code from a guild channel. Deletion cannot be undone; use discord_create_channel_invite to generate a replacement invite. Returns the deleted invite object containing its final metadata.",
  operationIds: ["invite_revoke"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageChannels", "ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    reason: reason.describe("Reason for revoking the invite in the guild audit log"),
  }),
  output: z.object({
    invite,
  }),
  execute: async ({ code, reason }, { discord }) => ({
    invite: await discord<RESTDeleteAPIInviteResult>({
      method: "DELETE",
      route: Routes.invite(encodeURIComponent(code)),
      reason,
    }),
  }),
});
