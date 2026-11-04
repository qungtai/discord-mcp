import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { type JoinRequest, joinRequest, joinRequestAction } from "./schemas.js";

export const reviewGuildJoinRequest = defineTool({
  name: "discord_review_guild_join_request",
  description:
    "Approve or reject a pending membership screening join request for a guild. Returns the updated join request record with its new status. To view pending requests first, use discord_list_guild_join_requests.",
  operationIds: ["action_guild_join_request"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    join_request: joinRequest,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    request_id: snowflake.describe("ID of the join request to review"),
    action: joinRequestAction,
    rejection_reason: z
      .string()
      .max(160)
      .nullable()
      .optional()
      .describe(
        "Optional reason given to the applicant when action is REJECTED (max 160 characters); ignored when APPROVED",
      ),
  }),
  execute: async ({ guild_id, request_id, ...body }, { discord }) => ({
    join_request: await discord<JoinRequest>({
      method: "PATCH",
      route: `/guilds/${guild_id}/requests/${request_id}`,
      body,
    }),
  }),
});
