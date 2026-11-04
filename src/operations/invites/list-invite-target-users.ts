import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode } from "./schemas.js";

export const listInviteTargetUsers = defineTool({
  name: "discord_list_invite_target_users",
  description:
    "Fetch the users allowed to accept an invite, as CSV text. The first line is the header user_id, followed by one user ID per line. To replace the list use discord_set_invite_target_users; to add one user use discord_add_invite_target_user. Returns the CSV in the csv field.",
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
