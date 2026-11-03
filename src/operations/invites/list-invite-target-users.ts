import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { inviteCode } from "./schemas.js";

export const listInviteTargetUsers = defineTool({
  name: "discord_list_invite_target_users",
  description:
    "Get the target users for an invite. The response is returned as CSV text in the csv field.",
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
