import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, incidentActions } from "./schemas.js";

export const updateGuildIncidentActions = defineTool({
  name: "discord_update_guild_incident_actions",
  description:
    "Pause or resume guild invites and direct messages during raid or security incidents. Timestamps must be future ISO 8601 strings up to 24 hours, or null to clear restrictions immediately. To audit raid mitigation actions use discord_list_guild_audit_log_entries. Returns the updated incident actions status.",
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
      .describe(
        "ISO 8601 timestamp up to 24 hours in the future when invites will be re-enabled, or null to clear pause immediately",
      ),
    dms_disabled_until: z.iso
      .datetime()
      .nullish()
      .describe(
        "ISO 8601 timestamp up to 24 hours in the future when direct messages will be re-enabled, or null to clear pause immediately",
      ),
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
