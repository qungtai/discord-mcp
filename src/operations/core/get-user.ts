import { type RESTGetAPIUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";

export const getUser = defineTool({
  name: "discord_get_user",
  description:
    "Fetch a Discord user profile by snowflake user ID, returning their username, global name, avatar, accent color, banner, and bot status. Use this when you have a specific user ID to resolve; to inspect the authenticated bot account use discord_get_my_user, and to find guild member data including roles and join dates use discord_get_guild_member. Returns the user object.",
  operationIds: ["get_user"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    user_id: snowflake.describe("ID of the Discord user to fetch"),
  }),
  output: z.object({ user }),
  execute: async ({ user_id }, { discord }) => ({
    user: await discord<RESTGetAPIUserResult>({
      method: "GET",
      route: Routes.user(user_id),
    }),
  }),
});
