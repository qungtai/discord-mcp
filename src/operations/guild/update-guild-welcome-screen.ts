import { type RESTPatchAPIGuildWelcomeScreenResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds, welcomeScreen } from "./schemas.js";

const welcomeScreenChannelInput = z.strictObject({
  channel_id: snowflake.describe(
    "Channel ID to feature on the welcome screen (numeric snowflake string)",
  ),
  description: z
    .string()
    .min(1)
    .max(50)
    .describe("Short description of why new members should visit this channel (1-50 characters)"),
  emoji_id: snowflake
    .nullish()
    .describe("Custom emoji ID to display next to the channel item if using a custom emoji"),
  emoji_name: z
    .string()
    .nullish()
    .describe("Unicode character or custom emoji name to display next to the channel item"),
});

export const updateGuildWelcomeScreen = defineTool({
  name: "discord_update_guild_welcome_screen",
  description:
    "Update the welcome screen configuration and recommended channels shown to new members. This feature requires Community to be enabled on the guild. To inspect current welcome screen settings use discord_get_guild_welcome_screen. Returns the updated welcome screen object.",
  operationIds: ["update_guild_welcome_screen"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    enabled: z
      .boolean()
      .nullish()
      .describe("Whether the welcome screen is enabled for incoming members"),
    welcome_channels: z
      .array(welcomeScreenChannelInput)
      .max(5)
      .nullish()
      .describe("Up to 5 featured channels displayed in order on the welcome screen"),
    description: z
      .string()
      .max(140)
      .nullish()
      .describe(
        "Server description or greeting text shown on the welcome screen (up to 140 characters)",
      ),
    reason,
  }),
  output: z.object({ welcome_screen: welcomeScreen }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    welcome_screen: await discord<RESTPatchAPIGuildWelcomeScreenResult>({
      method: "PATCH",
      route: Routes.guildWelcomeScreen(guild_id),
      body,
      reason,
    }),
  }),
});
