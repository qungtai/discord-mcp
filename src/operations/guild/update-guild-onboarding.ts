import { type RESTPutAPIGuildOnboardingResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds, onboarding } from "./schemas.js";

const promptOptionInput = z
  .strictObject({
    id: snowflake
      .nullish()
      .describe(
        "ID of the option; omit or pass null for new options, or specify existing option snowflake when updating",
      ),
    channel_ids: z
      .array(snowflake)
      .max(50)
      .nullish()
      .describe("Array of channel IDs members join when choosing this option (up to 50 channels)"),
    role_ids: z
      .array(snowflake)
      .max(50)
      .nullish()
      .describe("Array of role IDs assigned to members who choose this option (up to 50 roles)"),
    title: z.string().min(1).max(50).describe("Display title of the option (1-50 characters)"),
    description: z
      .string()
      .max(100)
      .nullish()
      .describe("Optional subtitle or explanation of the option (up to 100 characters)"),
    emoji_id: snowflake
      .nullish()
      .describe("Custom emoji snowflake ID if an emoji is used for this option"),
    emoji_name: z
      .string()
      .max(100)
      .nullish()
      .describe("Unicode emoji character or custom emoji name"),
    emoji_animated: z
      .boolean()
      .nullish()
      .describe("Whether the custom emoji is animated (defaults to false)"),
  })
  .describe("One answer option of a prompt");

const promptInput = z
  .strictObject({
    id: snowflake.describe(
      "ID of the prompt question (existing snowflake or newly generated snowflake)",
    ),
    type: z
      .number()
      .int()
      .nullish()
      .describe("Prompt type: 0 for MULTIPLE_CHOICE or 1 for DROPDOWN"),
    options: z
      .array(promptOptionInput)
      .min(1)
      .max(50)
      .describe("Array of 1 to 50 answer options members can select"),
    title: z
      .string()
      .min(1)
      .max(100)
      .describe("Prompt question title displayed to members (1-100 characters)"),
    single_select: z
      .boolean()
      .nullish()
      .describe("Whether members can select only a single option (defaults to false)"),
    required: z
      .boolean()
      .nullish()
      .describe(
        "Whether completing this prompt is required before joining channels (defaults to false)",
      ),
    in_onboarding: z
      .boolean()
      .nullish()
      .describe(
        "Whether the prompt is displayed during initial onboarding vs Channels & Roles tab only (defaults to false)",
      ),
  })
  .describe("One onboarding prompt with its answer options");

export const updateGuildOnboarding = defineTool({
  name: "discord_update_guild_onboarding",
  description:
    "Replace the onboarding setup of a guild: prompts with options, default channels, enabled flag and mode. Onboarding is a Community server feature. When enabled, Discord requires at least 7 default channels, at least 5 of which allow @everyone to send messages; mode 0 counts only default channels, mode 1 also counts prompts. Read the current setup first with discord_get_guild_onboarding. Returns the updated onboarding object.",
  operationIds: ["put_guilds_onboarding"],
  toolset: "guild",
  scope: {
    guild: "guild_id",
    channel: "default_channel_ids",
  },
  // ManageRoles is required when updating onboarding prompts and roles.
  permissions: ["ManageGuild", "ManageRoles"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    prompts: z
      .array(promptInput)
      .max(15)
      .nullish()
      .describe("Full list of up to 15 onboarding prompts. Replaces the existing prompts"),
    default_channel_ids: z
      .array(snowflake)
      .max(500)
      .optional()
      .describe(
        "Array of channel IDs every member gets added to without selecting onboarding options",
      ),
    enabled: z.boolean().nullish().describe("Whether onboarding is enabled for joining members"),
    mode: z
      .number()
      .int()
      .nullish()
      .describe("Onboarding mode: 0 for ONBOARDING_DEFAULT or 1 for ONBOARDING_ADVANCED"),
    reason,
  }),
  output: z.object({ onboarding }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    onboarding: await discord<RESTPutAPIGuildOnboardingResult>({
      method: "PUT",
      route: Routes.guildOnboarding(guild_id),
      body,
      reason,
    }),
  }),
});
