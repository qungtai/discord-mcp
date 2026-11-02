import { z } from "zod/v4";
import { role, snowflake } from "../schemas.js";

export const roleResult = z.object({ role });
export const rolesResult = z.object({ roles: z.array(role) });
export const roleMemberCountsResult = z.object({
  counts: z.record(snowflake, z.number()),
});
