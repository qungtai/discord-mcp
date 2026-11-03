import { type RESTDeleteAPIInviteResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason } from "../schemas.js";
import { invite, inviteCode } from "./schemas.js";

export const deleteInvite = defineTool({
  name: "discord_delete_invite",
  description: "Delete an invite by its code",
  operationIds: ["invite_revoke"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageChannels", "ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    reason,
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
