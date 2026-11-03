# qungtai/discord-mcp: coding rules

## 1. Stack
- TypeScript with `strict: true`, ESM only, current Node LTS pinned in `engines` in `package.json`.
- Package manager: pnpm. End users still install through the standard `npx -y <package>@<version>` client config.
- Discord access: `@discordjs/rest` for HTTP (rate limits, multipart uploads); `@discordjs/ws` for the Gateway (planned). No full `discord.js`.
- Schemas: zod. One schema per tool drives input validation and the MCP `outputSchema`.
- Tests: vitest. Lint and format: Biome.

## 2. Repository structure (by layer)
```
src/
  core/         registry, pipeline, policy, errors, credentials
  adapters/
    mcp/          stdio server wiring; Streamable HTTP wiring (planned)
    discord-rest/ REST client wrapper
    gateway/      Gateway client (planned)
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
2. Ports and adapters: core logic depends on interfaces, not on MCP or Discord libraries. Adapters implement MCP (stdio; HTTP planned), Discord REST, file access; Gateway planned.
3. One pipeline for every tool call: validate, resolve credential profile, policy check (allowlists, read-only, toolsets), preview and approval for destructive operations (preview planned), rate-limited execution, response mapping, audit, structured result. No tool bypasses it.
4. Command objects for mutating operations with `preview()` (planned) and `execute()`; dry-run (planned), approval binding and audit build on them.
5. Strategy for credential profiles (bot, webhook, OAuth user, app owner) and transports (stdio; HTTP planned).
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
- Every tool: schema tests, mocked REST contract tests and permission/error tests. Protocol tests run through a real MCP client over stdio (HTTP planned).
- Live verification is performed by running the server with `DISCORD_TOKEN` set against the contributor's own test server. Create only run-owned resources, record their IDs, clean up only those IDs.
- A schema rejection, dry-run preview or HTTP 2xx is not live verification; verification means reading the end state back.
- Code coverage gates (vitest): at least 80% lines and branches overall, 90% for `src/core`. `pnpm test` fails below these (thresholds in `vitest.config.ts`). Verification sequence: `pnpm install --frozen-lockfile && pnpm biome check --write . && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm tools:manifest && pnpm docs:tools && pnpm coverage:sync && pnpm coverage:report && pnpm coverage:check`.

## 7. Git workflow
- One branch per task: `feat/<toolset>-<task>`, `fix/<scope>-<task>`, `chore/<scope>-<task>`.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`). No AI co-author or attribution lines.
- One PR per task. Never force push to `main`.
- Contributors never print or commit credentials and never modify production Discord resources.

## 8. Documentation
- English for code, comments, docs and commit messages.
- README covers install per client, toolsets, required intents and permissions, safety settings.
- Changelog follows Keep a Changelog with semantic versioning.
