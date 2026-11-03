import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { inviteCode } from "./schemas.js";

export const addInviteTargetUser = defineTool({
  name: "discord_add_invite_target_user",
  description: "Add a target user to an existing invite",
  operationIds: ["add_invite_target_user"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "write",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    user_id: snowflake,
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
