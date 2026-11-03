import { type RESTGetAPIUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";

export const getUser = defineTool({
  name: "discord_get_user",
  description: "Get a user by ID",
  operationIds: ["get_user"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    user_id: snowflake,
  }),
  output: z.object({ user }),
  execute: async ({ user_id }, { discord }) => ({
    user: await discord<RESTGetAPIUserResult>({
      method: "GET",
      route: Routes.user(user_id),
    }),
  }),
});
