import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { inviteCode } from "./schemas.js";

export const addInviteTargetUser = defineTool({
  name: "discord_add_invite_target_user",
  description:
    "Add a single target user to an existing invite code so only authorized users can accept it. Target users can also be uploaded in bulk via CSV using discord_set_invite_target_users or discord_bulk_add_invite_target_users. Use discord_delete_invite_target_user to remove a user. Returns the added status, invite code, and user ID.",
  operationIds: ["add_invite_target_user"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "write",
  // Target users can accept a role-granting invite, the same privilege path as add_guild_member_role.
  approval: true,
  idempotent: true,
  input: z.object({
    code: inviteCode,
    user_id: snowflake.describe(
      "Snowflake ID of the user to add as an authorized target for this invite",
    ),
  }),
  output: z.object({
    added: z.literal(true),
    code: z.string(),
    user_id: snowflake,
  }),
  execute: async ({ code, user_id }, { discord }) => {
    await discord<void>({
      method: "PUT",
      route: `${Routes.inviteTargetUsers(encodeURIComponent(code))}/${user_id}`,
    });
    return {
      added: true as const,
      code,
      user_id,
    };
  },
});
