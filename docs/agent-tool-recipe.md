# Adding a tool

Rules every toolset agent follows. Coding rules in `AGENTS.md` still apply.

## Where the code goes
- All tools of a toolset live in one file: `src/operations/<toolset>/tools.ts`. Schemas used only by that toolset go in `src/operations/<toolset>/schemas.ts`.
- `src/operations/schemas.ts` holds cross-toolset types only (`snowflake`, `user`, `message`, `channel`, `role`, `member`, `attachment`, `allowedMentions`, `fileUpload`, `attachmentUpdate`). Reuse them; add to it only after the lead agrees.
- Every exported `defineTool` is registered automatically. Do not edit `src/core`, `TOOLSETS` or any registration list.

## The shape
```ts
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
    channel: await discord<RESTGetAPIChannelResult>({ method: "GET", route: Routes.channel(p.channel_id) }),
  }),
});
```
- `name`: `discord_<verb>_<noun>`. Input keys: snake_case Discord field names.
- `operationIds`: IDs from `coverage/register.json`, copied exactly. A test checks them once the register lands.
- `credential`: omit for the bot token (the default). Never take a token or webhook URL as an input.
- `permissions`: the bot permissions Discord checks; they appear in the 403 remediation.
- Routes come from `Routes` and result types from `discord-api-types/v10`.
- Lists pass the parsed input as `query`; undefined values are dropped: `execute: async ({ guild_id, ...query }, { discord }) => ... discord({ method: "GET", route, query })`.
- Pass `reason` on the request when the endpoint accepts `X-Audit-Log-Reason` and the input has `reason`.

## Effect, approval and idempotency
- `effect: "read"` for GET only, `"write"` for additive changes (create, send, add), `"destructive"` for anything that replaces or removes state (update, overwrite, delete, remove). `effect` drives the MCP annotations and read-only mode.
- `approval` defaults to `effect === "destructive"`, and such tools stay hidden and refused until the approval flow ships. Set `approval: false` only for non-additive changes that are safe without approval (editing the bot's own messages, renaming a channel). Keep the default for deletes of resources or other users' content, bulk operations, moderation (ban, kick, timeout, prune), permission overwrites and role permission changes. Say why in a comment.
- `idempotent: true` only when repeating the call leaves the same end state (GET, PUT, most PATCH, DELETE). POST is usually `false`; the pipeline then reports an uncertain result instead of a retry.
- Do not write previews or change summaries this wave.

## Scope (guild allowlist)
- Every guild or channel ID the tool touches must be a top-level input listed in `scope`, as a key name or array of key names: `scope: { guild: "guild_id", channel: ["channel_id", "target_channel_ids"] }`.
- A scope key's value must be a string or string[]. Anything else fails the call.
- Never read a resource ID from a nested object. Flatten it to a top-level input instead (for example `reference_channel_id`, not `message_reference.channel_id`).
- Use `scope: "none"` only for tools with no guild or channel (current user, gateway info).

## Inputs and outputs
- No function defaults in inputs (`.default(() => ...)`). They are evaluated once and advertised as a fixed value. Generate values in `execute` (`p.nonce ?? randomBytes(12).toString("hex")`).
- Nested input objects use `z.strictObject`, so misspelled keys fail.
- Every tool that sends message content (messages, webhooks, threads, forum posts, interactions) uses `allowed_mentions: allowedMentions` from `schemas.ts`. Never ping by default.
- Outputs reuse the lenient shared schemas. Require IDs only.
- Throw `PToolError` with a category and remediation for tool-level failures. Do not catch Discord errors; the pipeline maps them.

## Tests
- File: `test/operations/<toolset>/tools.test.ts`. Use `harness()` from `test/support/harness.ts`, which goes through a real MCP client.
- For each tool: call it with `client.callTool`, assert the exact method, URL and request body as literals (`toEqual`, not `toMatchObject` on the body), and the exact `structuredContent`.
- Cover each validation rule you add, a 403 and a 404 (`errorOf(result)` with the literal category and message), and the allowlist denial for scoped tools.
- Do not assert on mocks you control only. A test must fail if the tool drops a field from the request.
- Live tests are opt-in and only against the test server listed in `AGENTS.md`.

## Before the PR
`pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm tools:manifest`. Check that your tools appear in `coverage/tools.json` with the right `effect` and `approval`.
