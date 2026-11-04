import { type RESTPatchAPICurrentUserResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { dataUri, user } from "../schemas.js";

export const updateMyUser = defineTool({
  name: "discord_update_my_user",
  description:
    "Update the authenticated bot's global username, avatar image, or banner image. Changes apply globally across every server the bot is in. Changing the username can randomize the discriminator. To change the bot's nickname or avatar in one guild only, use discord_update_my_guild_member (members toolset). Returns the updated bot user object.",
  operationIds: ["update_my_user"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "destructive",
  // Changing the bot's username, avatar, or banner modifies its profile across all servers.
  approval: true,
  idempotent: true,
  input: z.object({
    username: z
      .string()
      .min(2)
      .max(32)
      .optional()
      .describe(
        "New global username for the bot account (2 to 32 characters); cannot contain @, #, :, three backticks (```) or 'discord', and cannot be 'everyone' or 'here'",
      ),
    avatar: dataUri
      .nullish()
      .describe(
        "New avatar image as a base64 data URI (png, jpeg, gif, webp), or null to clear avatar",
      ),
    banner: dataUri
      .nullish()
      .describe(
        "New banner image as a base64 data URI (png, jpeg, gif, webp), or null to clear banner",
      ),
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
