import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { exceptionOverrideInput, guildScheduledEventException } from "./schemas.js";

export const updateGuildScheduledEventException = defineTool({
  name: "discord_update_guild_scheduled_event_exception",
  description: "Modify an exception for a recurring guild scheduled event",
  operationIds: ["update_guild_scheduled_event_exception"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    exception_id: snowflake,
    ...exceptionOverrideInput,
  }),
  output: z.object({
    guild_scheduled_event_exception: guildScheduledEventException,
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, exception_id, ...body }, { discord }) => ({
    guild_scheduled_event_exception: await discord<z.infer<typeof guildScheduledEventException>>({
      method: "PATCH",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/exceptions/${exception_id}`,
      body,
    }),
  }),
});
