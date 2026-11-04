import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode } from "./schemas.js";

export const listInviteTargetUsers = defineTool({
  name: "discord_list_invite_target_users",
  description:
    "Fetch the list of authorized target user IDs for an invite code. The response is returned as CSV text with one user ID snowflake per line (no header). Use discord_set_invite_target_users to replace the target users with a new CSV file. Returns the CSV string in the csv field.",
  operationIds: ["get_invite_target_users"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object({
    code: inviteCode,
  }),
  output: z.object({
    csv: z.string(),
  }),
  execute: async ({ code }, { discord }) => {
    const buffer = await discord<ArrayBuffer>({
      method: "GET",
      route: Routes.inviteTargetUsers(encodeURIComponent(code)),
    });
    return {
      csv: Buffer.from(buffer).toString("utf8"),
    };
  },
});
