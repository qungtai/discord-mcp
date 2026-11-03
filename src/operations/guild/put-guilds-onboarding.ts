import { type RESTPutAPIGuildOnboardingResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";
import { guildIds, onboarding } from "./guild-settings-schemas.js";

const promptOptionInput = z.strictObject({
  id: snowflake.nullish(),
  channel_ids: z.array(snowflake).max(50).nullish(),
  role_ids: z.array(snowflake).max(50).nullish(),
  title: z.string().min(1).max(50),
  description: z.string().max(100).nullish(),
  emoji_id: snowflake.nullish(),
  emoji_name: z.string().max(100).nullish(),
  emoji_animated: z.boolean().nullish(),
});

const promptInput = z.strictObject({
  id: snowflake,
  type: z.number().int().nullish(),
  options: z.array(promptOptionInput).min(1).max(50),
  title: z.string().min(1).max(100),
  single_select: z.boolean().nullish(),
  required: z.boolean().nullish(),
  in_onboarding: z.boolean().nullish(),
});

export const putGuildsOnboarding = defineTool({
  name: "discord_put_guilds_onboarding",
  description: "Set the onboarding configuration for a guild",
  operationIds: ["put_guilds_onboarding"],
  toolset: "guild",
  scope: {
    guild: "guild_id",
    channel: "default_channel_ids",
  },
  permissions: ["ManageGuild"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    ...guildIds,
    prompts: z.array(promptInput).max(15).nullish(),
    default_channel_ids: z.array(snowflake).max(500).optional().describe("Default channel IDs"),
    enabled: z.boolean().nullish(),
    mode: z.number().int().nullish(),
    reason,
  }),
  output: z.object({ onboarding }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    onboarding: (await discord<RESTPutAPIGuildOnboardingResult>({
      method: "PUT",
      route: Routes.guildOnboarding(guild_id),
      body,
      reason,
    })) as unknown as { guild_id: string },
  }),
});
