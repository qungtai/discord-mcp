import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { type JoinRequest, joinRequest, joinRequestAction } from "./schemas.js";

export const actionGuildJoinRequest = defineTool({
  name: "discord_action_guild_join_request",
  description:
    "Approve or reject a guild join request. rejection_reason is only used when action is REJECTED",
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
    guild_id: snowflake,
    request_id: snowflake,
    action: joinRequestAction,
    rejection_reason: z.string().max(160).nullable().optional(),
  }),
  execute: async ({ guild_id, request_id, ...body }, { discord }) => ({
    join_request: await discord<JoinRequest>({
      method: "PATCH",
      route: `/guilds/${guild_id}/requests/${request_id}`,
      body,
    }),
  }),
});
