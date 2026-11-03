import { z } from "zod/v4";
import { snowflake, user } from "../schemas.js";

export const guildIds = { guild_id: snowflake };

export const guild = z.looseObject({
  id: snowflake,
  name: z.string().optional(),
  icon: z.string().nullish(),
  description: z.string().nullish(),
  home_header: z.string().nullish(),
  splash: z.string().nullish(),
  discovery_splash: z.string().nullish(),
  features: z.array(z.string()).optional(),
  banner: z.string().nullish(),
  owner_id: snowflake.optional(),
  application_id: snowflake.nullish(),
  region: z.string().nullish(),
  afk_channel_id: snowflake.nullish(),
  afk_timeout: z.number().optional(),
  system_channel_id: snowflake.nullish(),
  system_channel_flags: z.number().optional(),
  widget_enabled: z.boolean().optional(),
  widget_channel_id: snowflake.nullish(),
  verification_level: z.number().optional(),
  default_message_notifications: z.number().optional(),
  mfa_level: z.number().optional(),
  explicit_content_filter: z.number().optional(),
  vanity_url_code: z.string().nullish(),
  premium_tier: z.number().optional(),
  premium_subscription_count: z.number().optional(),
  preferred_locale: z.string().optional(),
  rules_channel_id: snowflake.nullish(),
  safety_alerts_channel_id: snowflake.nullish(),
  public_updates_channel_id: snowflake.nullish(),
  approximate_member_count: z.number().optional(),
  approximate_presence_count: z.number().optional(),
});

export const guildPreview = z.looseObject({
  id: snowflake,
  name: z.string().optional(),
  icon: z.string().nullish(),
  splash: z.string().nullish(),
  discovery_splash: z.string().nullish(),
  features: z.array(z.string()).optional(),
  approximate_member_count: z.number().optional(),
  approximate_presence_count: z.number().optional(),
  description: z.string().nullish(),
});

export const auditLog = z.looseObject({
  audit_log_entries: z.array(z.looseObject({ id: snowflake })).optional(),
  users: z.array(user).optional(),
  integrations: z.array(z.looseObject({ id: snowflake })).optional(),
  webhooks: z.array(z.looseObject({ id: snowflake })).optional(),
  guild_scheduled_events: z.array(z.looseObject({ id: snowflake })).optional(),
  threads: z.array(z.looseObject({ id: snowflake })).optional(),
  application_commands: z.array(z.looseObject({ id: snowflake })).optional(),
  auto_moderation_rules: z.array(z.looseObject({ id: snowflake })).optional(),
});

export const integration = z.looseObject({
  id: snowflake,
  name: z.string().optional(),
  type: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const incidentActions = z.looseObject({
  invites_disabled_until: z.string().nullish(),
  dms_disabled_until: z.string().nullish(),
});

export const vanityUrl = z.looseObject({
  code: z.string().nullish(),
  uses: z.number().optional(),
});

export const welcomeScreen = z.looseObject({
  description: z.string().nullish(),
  welcome_channels: z
    .array(
      z.looseObject({
        channel_id: snowflake,
        description: z.string().optional(),
        emoji_id: snowflake.nullish(),
        emoji_name: z.string().nullish(),
      }),
    )
    .optional(),
});

export const onboarding = z.looseObject({
  guild_id: snowflake,
  prompts: z.array(z.looseObject({ id: snowflake })).optional(),
  default_channel_ids: z.array(snowflake).optional(),
  enabled: z.boolean().optional(),
  mode: z.number().optional(),
});

export const widgetSettings = z.looseObject({
  enabled: z.boolean().optional(),
  channel_id: snowflake.nullish(),
});

export const widget = z.looseObject({
  id: snowflake,
  name: z.string().optional(),
  instant_invite: z.string().nullish(),
  channels: z.array(z.looseObject({ id: snowflake })).optional(),
  members: z.array(z.looseObject({ id: snowflake })).optional(),
  presence_count: z.number().optional(),
});

export const newMemberWelcome = z.looseObject({
  guild_id: snowflake,
  enabled: z.boolean().optional(),
  new_member_actions: z.array(z.looseObject({})).optional(),
  resource_channels: z.array(z.looseObject({})).optional(),
});
