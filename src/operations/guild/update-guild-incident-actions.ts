import { type RESTPutAPIGuildIncidentActionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, incidentActions } from "./guild-settings-schemas.js";

export const updateGuildIncidentActions = defineTool({
  name: "discord_update_guild_incident_actions",
  description: "Update incident actions (safety alerts / lockdown) for a guild",
  operationIds: ["update_guild_incident_actions"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    invites_disabled_until: z
      .string()
      .nullish()
      .describe("When invites will be enabled again (ISO8601 timestamp)"),
    dms_disabled_until: z
      .string()
      .nullish()
      .describe("When direct messages will be enabled again (ISO8601 timestamp)"),
  }),
  output: z.object({ incident_actions: incidentActions }),
  execute: async ({ guild_id, ...body }, { discord }) => ({
    incident_actions: await discord<RESTPutAPIGuildIncidentActionsResult>({
      method: "PUT",
      route: Routes.guildIncidentActions(guild_id),
      body,
    }),
  }),
});
