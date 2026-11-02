import { z } from "zod/v4";
import { snowflake, user } from "../schemas.js";

export const templateCode = z.string().min(1);

export const guildTemplate = z.object({
  code: z.string(),
  name: z.string().optional(),
  description: z.string().nullish(),
  usage_count: z.number().optional(),
  creator_id: snowflake.optional(),
  creator: user.nullish(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  source_guild_id: snowflake.optional(),
  serialized_source_guild: z.unknown().optional(),
  is_dirty: z.boolean().nullish(),
});

export const templateResult = z.object({ template: guildTemplate });
export const templatesResult = z.object({ templates: z.array(guildTemplate) });
