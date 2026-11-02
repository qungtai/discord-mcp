import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import {
  type APIGuildScheduledEventExceptionData,
  guildScheduledEventException,
} from "./mem-events-schemas.js";

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
    original_scheduled_start_time: z
      .string()
      .describe("Original start time of the occurrence (ISO8601)"),
    scheduled_start_time: z
      .string()
      .nullable()
      .optional()
      .describe("Overridden start time (ISO8601)"),
    scheduled_end_time: z.string().nullable().optional().describe("Overridden end time (ISO8601)"),
    is_canceled: z.boolean().nullable().optional().describe("Whether this occurrence is canceled"),
  }),
  output: z.object({
    guild_scheduled_event_exception: guildScheduledEventException,
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, ...body }, { discord }) => {
    const exception = await discord<APIGuildScheduledEventExceptionData>({
      method: "POST",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/exceptions`,
      body,
    });
    return { guild_scheduled_event_exception: exception };
  },
});
