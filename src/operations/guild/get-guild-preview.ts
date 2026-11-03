import { type RESTGetAPIGuildPreviewResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, guildPreview } from "./guild-settings-schemas.js";

export const getGuildPreview = defineTool({
  name: "discord_get_guild_preview",
  description: "Get a guild's preview",
  operationIds: ["get_guild_preview"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ guild_preview: guildPreview }),
  execute: async ({ guild_id }, { discord }) => ({
    guild_preview: (await discord<RESTGetAPIGuildPreviewResult>({
      method: "GET",
      route: Routes.guildPreview(guild_id),
    })) as unknown as { id: string },
  }),
});
