import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode, targetUserIds } from "./schemas.js";

export const bulkAddInviteTargetUsers = defineTool({
  name: "discord_bulk_add_invite_target_users",
  description:
    "Add multiple target users to an existing invite code in a single API call (up to 1000 user IDs). Target users can also be uploaded from a CSV file using discord_set_invite_target_users. Use discord_bulk_delete_invite_target_users to remove multiple users at once. Returns the added status, invite code, and count of users added.",
  operationIds: ["bulk_add_invite_target_users"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "write",
  // Target users can accept a role-granting invite, the same privilege path as add_guild_member_role.
  approval: true,
  idempotent: false,
  input: z.object({
    code: inviteCode,
    user_ids: targetUserIds,
  }),
  output: z.object({
    added: z.literal(true),
    code: z.string(),
    count: z.number().int(),
  }),
  execute: async ({ code, user_ids }, { discord }) => {
    await discord<void>({
      method: "POST",
      route: `${Routes.inviteTargetUsers(encodeURIComponent(code))}/bulk-add`,
      body: { user_ids },
    });
    return {
      added: true as const,
      code,
      count: user_ids.length,
    };
  },
});
