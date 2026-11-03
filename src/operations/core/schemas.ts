import { z } from "zod/v4";
import { dataUri, resource, snowflake } from "../schemas.js";

export { dataUri };

export const partialGuild = resource(
  z.looseObject({
    id: snowflake,
    name: z.string().optional(),
    icon: z.string().nullish(),
    banner: z.string().nullish(),
    owner: z.boolean().optional(),
    permissions: z.string().optional(),
    features: z.array(z.string()).optional(),
    approximate_member_count: z.number().optional(),
    approximate_presence_count: z.number().optional(),
  }),
);

export const connection = resource(
  z.looseObject({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    revoked: z.boolean().optional(),
    integrations: z.array(z.looseObject({ id: z.string() })).optional(),
    verified: z.boolean().optional(),
    friend_sync: z.boolean().optional(),
    show_activity: z.boolean().optional(),
    two_way_link: z.boolean().optional(),
    visibility: z.number().optional(),
  }),
);
