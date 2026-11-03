import { type RESTGetAPIInviteTargetUsersJobStatusResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode, targetUsersJobStatus } from "./schemas.js";

export const getInviteTargetUsersJobStatus = defineTool({
  name: "discord_get_invite_target_users_job_status",
  description: "Get the target users job status for an invite",
  operationIds: ["get_invite_target_users_job_status"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object({
    code: inviteCode,
  }),
  output: z.object({
    job_status: targetUsersJobStatus,
  }),
  execute: async ({ code }, { discord }) => ({
    job_status: await discord<RESTGetAPIInviteTargetUsersJobStatusResult>({
      method: "GET",
      route: Routes.inviteTargetUsersJobStatus(encodeURIComponent(code)),
    }),
  }),
});
