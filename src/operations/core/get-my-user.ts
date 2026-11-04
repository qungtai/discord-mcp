import { type RESTGetAPICurrentUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { user } from "../schemas.js";

export const getMyUser = defineTool({
  name: "discord_get_my_user",
  description:
    "Fetch user details for the currently authenticated bot account, including username, discriminator, avatar, flags, and bot status. Use this to inspect the bot's own identity and settings, or to check which user token is active. To look up another Discord user by ID, use discord_get_user instead. Returns the bot user object.",
  operationIds: ["get_my_user"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({}),
  output: z.object({ user }),
  execute: async (_params, { discord }) => ({
    user: await discord<RESTGetAPICurrentUserResult>({
      method: "GET",
      route: Routes.user(),
    }),
  }),
});
