import { type RESTPatchAPICurrentUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { user } from "../schemas.js";
import { dataUri } from "./schemas.js";

export const updateMyUser = defineTool({
  name: "discord_update_my_user",
  description: "Update the current bot's username, avatar, or banner",
  operationIds: ["update_my_user"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "destructive",
  // Changing the bot's username, avatar, or banner modifies its profile across all servers.
  approval: true,
  idempotent: true,
  input: z.object({
    username: z.string().min(2).max(32).optional(),
    avatar: dataUri.nullish(),
    banner: dataUri.nullish(),
  }),
  output: z.object({ user }),
  execute: async (body, { discord }) => ({
    user: await discord<RESTPatchAPICurrentUserResult>({
      method: "PATCH",
      route: Routes.user(),
      body,
    }),
  }),
});
