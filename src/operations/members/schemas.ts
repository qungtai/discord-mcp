import { z } from "zod/v4";
import { resource, snowflake } from "../schemas.js";

export const joinRequestStatus = z
  .enum(["STARTED", "SUBMITTED", "REJECTED", "APPROVED"])
  .describe("Application status of the join request");

export const joinRequestAction = z
  .enum(["APPROVED", "REJECTED"])
  .describe("Action to take on the join request: APPROVED or REJECTED");

export const joinRequest = resource(
  z.looseObject({
    id: snowflake,
    guild_id: snowflake,
    user_id: snowflake,
    application_status: joinRequestStatus.nullish(),
    created_at: z.string().optional(),
    reviewed_at: z.string().nullish(),
    rejection_reason: z.string().nullish(),
    user: z
      .looseObject({
        id: snowflake,
        username: z.string().optional(),
      })
      .optional(),
  }),
);

export type JoinRequest = z.infer<typeof joinRequest>;

export const pruneCount = z.object({
  pruned: z.number().nullable(),
});
