import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, incidentActions } from "./schemas.js";

export const updateGuildIncidentActions = defineTool({
  name: "discord_update_guild_incident_actions",
  description: "Update the time until invites or DMs are disabled for a guild",
  operationIds: ["update_guild_incident_actions"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    invites_disabled_until: z.iso
      .datetime()
      .nullish()
      .describe("When invites will be enabled again (ISO8601 timestamp)"),
    dms_disabled_until: z.iso
      .datetime()
      .nullish()
      .describe("When direct messages will be enabled again (ISO8601 timestamp)"),
  }),
  output: z.object({ incident_actions: incidentActions }),
  execute: async ({ guild_id, ...body }, { discord }) => ({
    incident_actions: await discord({
      method: "PUT",
      route: `/guilds/${guild_id}/incident-actions`,
      body,
    }),
  }),
});
