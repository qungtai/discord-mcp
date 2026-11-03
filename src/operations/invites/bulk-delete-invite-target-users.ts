import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { inviteCode } from "./schemas.js";

export const bulkDeleteInviteTargetUsers = defineTool({
  name: "discord_bulk_delete_invite_target_users",
  description: "Remove multiple target users from an existing invite",
  operationIds: ["bulk_remove_invite_target_users"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: false,
  input: z.object({
    code: inviteCode,
    user_ids: z.array(snowflake).min(1).max(1000),
  }),
  output: z.object({
    deleted: z.literal(true),
    code: z.string(),
    count: z.number().int(),
  }),
  execute: async ({ code, user_ids }, { discord }) => {
    await discord<void>({
      method: "POST",
      route: `${Routes.inviteTargetUsers(encodeURIComponent(code))}/bulk-delete`,
      body: { user_ids },
    });
    return {
      deleted: true as const,
      code,
      count: user_ids.length,
    };
  },
});
