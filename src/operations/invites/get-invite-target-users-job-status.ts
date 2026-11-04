import { type RESTGetAPIInviteTargetUsersJobStatusResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode, targetUsersJobStatus } from "./schemas.js";

export const getInviteTargetUsersJobStatus = defineTool({
  name: "discord_get_invite_target_users_job_status",
  description:
    "Check the status of an asynchronous target user CSV processing job for an invite. status is 1 while processing, then 2 when completed or 3 when failed (see error_message); 0 is the unset default. Use discord_set_invite_target_users to initiate a CSV upload. Returns the job status object with total_users, processed_users, and error_message.",
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
