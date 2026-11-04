import { type RESTGetAPIUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";

export const getUser = defineTool({
  name: "discord_get_user",
  description:
    "Fetch any Discord user by user ID: username, global name, avatar, banner, accent color and whether the account is a bot. Use it to resolve an ID taken from a message author, a mention or a poll voter; for the bot's own account use discord_get_my_user, and for guild data such as nickname, roles and join date use discord_get_guild_member (members toolset). Returns the user object.",
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
