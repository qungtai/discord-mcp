import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode } from "./schemas.js";

export const setInviteTargetUsers = defineTool({
  name: "discord_set_invite_target_users",
  description:
    "Replace the authorized target users for an invite by uploading a CSV file. The CSV has a single column of user IDs, one per line; duplicates are ignored and invalid IDs fail with a 400 that lists them. Triggering this upload starts an asynchronous processing job; poll progress with discord_get_invite_target_users_job_status. Returns the updated status and invite code.",
  operationIds: ["update_invite_target_users"],
  toolset: "invites",
  scope: { invite: "code" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    code: inviteCode,
    file: z
      .strictObject({
        path: z
          .string()
          .describe(
            "Absolute local filesystem path to the CSV file containing user snowflake IDs (one per line)",
          ),
        filename: z
          .string()
          .optional()
          .describe("Optional override filename for the multipart file upload"),
      })
      .describe("Local CSV file descriptor containing user snowflake IDs to set as targets"),
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
