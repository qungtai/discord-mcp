import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { inviteCode } from "./schemas.js";

export const deleteInviteTargetUser = defineTool({
  name: "discord_delete_invite_target_user",
  description:
    "Remove a single target user from an existing invite code. To remove multiple target users at once, use discord_bulk_delete_invite_target_users. Use discord_add_invite_target_user to grant an authorized user access to this invite. Returns the deleted status, invite code, and removed user ID.",
  operationIds: ["remove_invite_target_user"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    user_id: snowflake.describe("Snowflake ID of the user to remove from this targeted invite"),
  }),
  output: z.object({
    deleted: z.literal(true),
    code: z.string(),
    user_id: snowflake,
  }),
  execute: async ({ code, user_id }, { discord }) => {
    await discord<void>({
      method: "DELETE",
      route: `${Routes.inviteTargetUsers(encodeURIComponent(code))}/${user_id}`,
    });
    return {
      deleted: true as const,
      code,
      user_id,
    };
  },
});
