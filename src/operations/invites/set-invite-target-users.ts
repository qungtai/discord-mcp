import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode } from "./schemas.js";

export const setInviteTargetUsers = defineTool({
  name: "discord_set_invite_target_users",
  description: "Set the target users for an invite using a CSV file.",
  operationIds: ["update_invite_target_users"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    file: z.strictObject({
      path: z.string(),
      filename: z.string().optional(),
    }),
  }),
  output: z.object({
    updated: z.literal(true),
    code: z.string(),
  }),
  execute: async ({ code, file }, { discord, files }) => {
    const prepared = await files.prepare([file]);
    const fileWithKey = prepared.files.map((f) => ({
      ...f,
      key: "target_users_file",
    }));
    await discord<void>({
      method: "PUT",
      route: Routes.inviteTargetUsers(encodeURIComponent(code)),
      files: fileWithKey,
    });
    return {
      updated: true as const,
      code,
    };
  },
});
