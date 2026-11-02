# qungtai/discord-mcp: coding rules

Status: agreed with the owner on 3 November 2026. Becomes the repo's `AGENTS.md` (`CLAUDE.md` points to it). Every agent brief references this file. Product requirements live in `discord-mcp-prd-v0.2.md`.

## 1. Stack
- TypeScript with `strict: true`, ESM only, current Node LTS pinned in `.nvmrc` and `engines`.
- Package manager: pnpm. End users still install through the standard `npx -y <package>@<version>` client config.
- Discord access: `@discordjs/rest` for HTTP (rate limits, multipart uploads); `@discordjs/ws` for the Gateway when phase 5 starts. No full `discord.js`.
- Schemas: zod. One schema per tool drives input validation and the MCP `outputSchema`.
- Tests: vitest. Lint and format: Biome.

## 2. Repository structure (by layer)
```
src/
  core/         registry, pipeline, policy, errors, credentials
  adapters/
    mcp/          stdio and Streamable HTTP server wiring
    discord-rest/ REST client wrapper
    gateway/      Gateway client (phase 5)
    files/        sandboxed local file access
  operations/<toolset>/   one file per tool descriptor, e.g. operations/messages/send-message.ts
test/           mirrors src/; unit, contract, protocol and opt-in live suites
scripts/        baseline import, coverage report, release helpers
docs/           per-client setup, toolsets, coverage report
coverage/       pinned baseline and operation register (machine-readable)
```

## 3. Naming
- Files and folders: kebab-case (`tool-registry.ts`, `send-message.ts`).
- Core classes take a `P` prefix: registry, pipeline, policy engine, adapters, facades and other central building blocks (`PToolRegistry`, `PPolicyEngine`, `PToolPipeline`, `PDiscordRestAdapter`, `PAttachmentService`). Small helpers, schemas, plain functions and types do not.
- Other classes and types: PascalCase. Functions and variables: camelCase. Constants and env vars: UPPER_SNAKE_CASE.
- MCP tool names: `discord_<verb>_<noun>`, snake_case (`discord_send_message`).
- Tool parameters: snake_case matching Discord API field names (`channel_id`, `allowed_mentions`).
- Test files: `*.test.ts` under `test/`, mirroring the source path.

## 4. Design patterns
1. Operation registry: each Discord operation is a descriptor (id, method, path, zod input and output, credential profile, permissions, annotations, toolset). The registry is the single source for tool registration, the coverage report and generated test skeletons.
2. Ports and adapters: core logic depends on interfaces, not on MCP or Discord libraries. Adapters implement MCP (stdio, HTTP), Discord REST, Gateway and file access.
3. One pipeline for every tool call: validate, resolve credential profile, policy check (allowlists, read-only, toolsets), preview and approval for destructive operations, rate-limited execution, response mapping, audit, structured result. No tool bypasses it.
4. Command objects for mutating operations with `preview()` and `execute()`; dry-run, approval binding and audit build on them.
5. Strategy for credential profiles (bot, webhook, OAuth user, app owner) and transports (stdio, HTTP).
6. `defineTool()` factory builds every tool from its descriptor; no hand-rolled tool boilerplate.
7. `PAttachmentService` facade owns uploads (multipart), keep/remove/replace, metadata edits, downloads with SHA-256 and path sandboxing.
8. Structured errors: one error type with category, retryable flag, remediation, operation ID and resource IDs. The pipeline converts thrown errors into MCP error results.

Avoid: deep inheritance, god classes, a generic "call any endpoint" tool outside the registry, and per-tool structures that differ from the descriptor pattern.

## 5. Code style
- Biome: 2-space indentation, line width 100, double quotes, semicolons, trailing commas, recommended lint rules.
- Comments only where intent is not obvious from the code.
- No `any` to silence types, no swallowed errors, no `setTimeout` workarounds, no dead code.
- In stdio mode nothing but protocol messages goes to stdout; logs go to stderr through MCP `notifications/message` where appropriate. Secrets are redacted in every log and error.

## 6. Testing
- Every tool: schema tests, mocked REST contract tests and permission/error tests. Protocol tests run through a real MCP client over stdio and HTTP.
- Live tests are opt-in via env vars and run only against the test server: lequangtai's server (`1381945630808604713`) with `lequangtaibot`. Create only run-owned resources, record their IDs, clean up only those IDs.
- A schema rejection, dry-run preview or HTTP 2xx is not live verification; verification means reading the end state back.
- Code coverage gates (vitest): at least 80% lines and branches overall, 90% for `src/core`. CI fails below these.

## 7. Git workflow
- Author: `Tai Q Le (Peter) <lequangtai1602@gmail.com>`, set per repo with `git config user.name` / `user.email`.
- One branch per task: `feat/<toolset>-<task>`, `fix/<scope>-<task>`, `chore/<scope>-<task>`.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`). No AI co-author or attribution lines.
- One PR per task. The lead reviews and tests; the owner approves before merge to `main`. No force pushes to `main`. Nothing is published to npm, Docker or the MCP Registry without the owner's approval.

## 8. Agents and worktrees
- All implementation is done by team agents through herdr; the lead briefs, reviews, integrates and verifies but does not write implementation code.
- Each agent works in its own herdr worktree and branch. The lead removes the worktree, branch and agent process after merge or abandonment; nothing is left behind.
- Agents never print or commit credentials and never change `~/.agents`, production Discord resources or bot permissions.

## 9. Documentation
- English for code, comments, docs and commit messages.
- README covers install per client, toolsets, required intents and permissions, safety settings.
- Changelog follows Keep a Changelog with semantic versioning.
