import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { exceptionOverrideInput, guildScheduledEventException } from "./schemas.js";

export const createGuildScheduledEventException = defineTool({
  name: "discord_create_guild_scheduled_event_exception",
  description: "Create an exception for a recurring guild scheduled event",
  operationIds: ["create_guild_scheduled_event_exception"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    original_scheduled_start_time: z.iso
      .datetime({ offset: true })
      .describe("Original start time of occurrence (ISO8601)"),
    ...exceptionOverrideInput,
  }),
  output: z.object({
    guild_scheduled_event_exception: guildScheduledEventException,
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, ...body }, { discord }) => ({
    guild_scheduled_event_exception: await discord<z.infer<typeof guildScheduledEventException>>({
      method: "POST",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/exceptions`,
      body,
    }),
  }),
});
