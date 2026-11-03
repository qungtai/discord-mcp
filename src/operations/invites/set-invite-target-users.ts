import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { fileUpload } from "../schemas.js";
import { inviteCode } from "./schemas.js";

export const setInviteTargetUsers = defineTool({
  name: "discord_set_invite_target_users",
  description: "Set the target users for an invite using a CSV file from sandboxed file roots.",
  operationIds: ["update_invite_target_users"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    file: fileUpload,
  }),
  output: z.object({
    updated: z.literal(true),
    code: z.string(),
  }),
  execute: async ({ code, file }, { discord, files }) => {
    const prepared = await files.prepare([file]);
    await discord<void>({
      method: "PUT",
      route: Routes.inviteTargetUsers(encodeURIComponent(code)),
      files: prepared.files,
    });
    return {
      updated: true as const,
      code,
    };
  },
});
