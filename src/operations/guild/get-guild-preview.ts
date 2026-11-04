import { type RESTGetAPIGuildPreviewResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, guildPreview } from "./schemas.js";

export const getGuildPreview = defineTool({
  name: "discord_get_guild_preview",
  description:
    "Fetch public preview data for a guild even if the bot is not a member. The target guild must be discoverable or public (have DISCOVERABLE feature or invite splash enabled). To fetch complete details for a guild the bot belongs to use discord_get_guild. Returns guild preview data including approximate presence and member counts.",
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
