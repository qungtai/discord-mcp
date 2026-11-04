import { type RESTGetAPIGuildPreviewResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, guildPreview } from "./schemas.js";

export const getGuildPreview = defineTool({
  name: "discord_get_guild_preview",
  description:
    "Fetch the public preview of a guild: name, icon, splash, emoji, stickers, features and approximate member and presence counts. If the bot is not a member, the guild must have the DISCOVERABLE feature. For full details of a guild the bot is in use discord_get_guild. Returns the guild preview object.",
  operationIds: ["get_guild_preview"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ guild_preview: guildPreview }),
  execute: async ({ guild_id }, { discord }) => ({
    guild_preview: await discord<RESTGetAPIGuildPreviewResult>({
      method: "GET",
      route: Routes.guildPreview(guild_id),
    }),
  }),
});
