# Adding a tool

Rules every toolset agent follows, on top of `AGENTS.md`. Requirements: `docs/planning/prd.md`.

## Where the code goes
- One file per tool: `src/operations/<toolset>/<verb>-<noun>.ts` exporting one `defineTool`, for example `src/operations/messages/send-message.ts`. Schemas shared inside a toolset go in `src/operations/<toolset>/schemas.ts`.
- Tests mirror the source path: `test/operations/<toolset>/<verb>-<noun>.test.ts`.
- `src/operations/schemas.ts` holds cross-toolset schemas (`snowflake`, `user`, `message`, `channel`, `role`, `member`, `attachment`, `allowedMentions`, `fileUpload`, `attachmentUpdate`, `reason`). Add to it only after the lead agrees.
- Every exported `defineTool` is registered automatically. Do not edit `src/core`, `TOOLSETS` or any registration list.

## The shape
```ts
import { type RESTGetAPIChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { channel, snowflake } from "../schemas.js";

export const getChannel = defineTool({
  name: "discord_get_channel",
  description: "Get a channel by ID",
  operationIds: ["get_channel"],
  toolset: "channels",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel"],
  effect: "read",
  idempotent: true,
  input: z.object({ channel_id: snowflake }),
  output: z.object({ channel }),
  execute: async (p, { discord }) => ({
    channel: await discord<RESTGetAPIChannelResult>({
      method: "GET",
      route: Routes.channel(p.channel_id),
    }),
  }),
});
```
- Import `z` from `"zod/v4"` (plain `"zod"` gives v3 types that do not fit `defineTool`). Relative imports end in `.js`.
- `name`: `discord_<verb>_<noun>`. Input keys: snake_case Discord field names.
- `operationIds`: IDs from `coverage/register.json`, copied exactly. A test checks them once the register lands.
- `permissions`: the bot permissions Discord checks; they appear in the 403 remediation.
- Routes come from `Routes` and result types from `discord-api-types/v10`.

## Credentials
- Only the bot profile is wired. Omit `credential`.
- Tools that need a webhook token, interaction token or OAuth user token (execute_webhook, webhook message tools, interaction responses, `oauth_user`) wait for their profile. Never take a token or webhook URL as an input.

## Effect, approval and idempotency
- `effect`: `"read"` for GET only; `"write"` for additive changes (create, send, add); `"destructive"` for anything that replaces or removes state (update, overwrite, delete, remove); `"local_write"` for tools that write a local file, like downloads. Every effect except `"read"` is refused in read-only mode.
- `approval` defaults to `effect === "destructive"`. Destructive tools ask the user for confirmation through MCP elicitation before executing. Set `approval: false` only for non-additive changes that are safe without approval (editing the bot's own messages, renaming a channel), with a comment saying why. Keep the default for deletes of resources or other users' content, bulk operations, moderation, permission overwrites and role permission changes.
- `idempotent: true` only when repeating the call leaves the same end state (GET, PUT, most PATCH, DELETE). POST is usually `false`; the pipeline then reports an uncertain result instead of a retry.
- Do not write previews or change summaries this wave.

## Scope (guild allowlist)
- Scope only IDs the route or body uses, as top-level inputs: `scope: { guild: "guild_id", channel: ["channel_id", "target_channel_ids"] }`. Values must be a string or string[].
- Kinds: `guild`, `channel` (thread IDs are channel IDs), `webhook` (webhook IDs), `invite` (invite codes), and `user`. Channels, webhooks and invites are looked up, so a guild input never vouches for them. The `user` kind resolves to a DM; use it only for tools that reach a user directly (e.g. `discord_create_dm`), never for guild member IDs (which belong to a guild and would refuse every guild call while DMs are off). `message` needs a `channel` next to it. Any other kind fails under an allowlist.
- IDs that Discord checks against the guild or channel in the route need no scope: role, member, emoji and overwrite IDs, and channel IDs inside `PATCH /guilds/{guild_id}/channels`. Message IDs take `message` next to their `channel`, as in the message tools. Every top-level `*_id`, `*_ids` and `code` input is audited whether scoped or not.
- `test/core/scope-declarations.test.ts` fails when a top-level guild, channel, thread or webhook ID input is not scoped. Add a key to its exception list only when Discord checks it against the route, with the reason in the PR.
- Never add a `guild_id` or `channel_id` input just to satisfy the allowlist, and never read a resource ID from a nested object.
- `scope: "none"` is for tools that touch no guild resource (current user, gateway, voice regions); the allowlist does not apply to them. Tools that list guilds or guild-owned resources across guilds filter the result with `context.allowsGuild(guild_id)`. Use `context.hasAllowlist` when a tool must behave differently under an allowlist.

## Inputs and outputs
- No function defaults in inputs. Generate values in `execute` (`p.nonce ?? randomBytes(12).toString("hex")`).
- Nested input objects use `z.strictObject`.
- Tools that send message content use `allowed_mentions: allowedMentions`.
- Audit log reason: add `reason` from `schemas.ts` and destructure it out of the body: `execute: async ({ guild_id, reason, ...body }, { discord }) => discord({ method: "PATCH", route, body, reason })`.
- Lists pass the input without route IDs as `query` (undefined values are dropped) and return paging cursors like `discord_list_messages`: `next_before` and `next_after` for lists that page both ways, `next_after` for ascending lists.
- Deletes and other 204 endpoints return `{ deleted: true, ...ids }` with the target IDs, for example `{ deleted: true, channel_id, message_id }`. Name the flag after the action for non-delete 204s (`{ pinned: true, ... }`).
- Outputs reuse the lenient shared schemas. Require IDs only.
- Throw `PToolError` with a category and remediation for tool-level failures. Do not catch Discord errors; the pipeline maps them.

## Tests
- Use `harness()` from `test/support/harness.ts`, which goes through a real MCP client.
- For each tool: assert the exact method, URL and request body as literals (`toEqual` on the body) and the exact `structuredContent`.
- Cover each validation rule you add, a 403 and a 404 (`errorOf(result)` with the literal category and message).
- Allowlist: the same call once succeeding under an allowlist that includes the guild, and once denied for another guild, with no write sent.
- A test must fail if the tool drops a field from the request. Live tests are opt-in and only against the test server in `AGENTS.md`.

## Before the PR
```sh
pnpm biome check --write .
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm tools:manifest && pnpm coverage:sync && pnpm coverage:report && pnpm coverage:check
```
Check that your tools appear in `coverage/tools.json` with the right `effect` and `approval`.
