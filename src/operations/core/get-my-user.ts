import { type RESTGetAPICurrentUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { user } from "../schemas.js";

export const getMyUser = defineTool({
  name: "discord_get_my_user",
  description:
    "Fetch the bot's own user object: id, username, global name, avatar, banner and flags. Use it to confirm which account the token belongs to; to look up any other user by ID use discord_get_user. Returns the user object.",
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
