# Contributing

Thank you for contributing to `@qungtai/discord-mcp`.

## Prerequisites

- Node.js >= 22 (pinned in `.nvmrc` and `package.json` engines)
- Corepack enabled (`corepack enable`)
- pnpm (`corepack prepare pnpm@latest --activate` or through your package manager)

## Getting started

Clone the repository and install dependencies:

```sh
pnpm install
```

## Adding a tool

Follow the tool specification and recipe in [docs/agent-tool-recipe.md](docs/agent-tool-recipe.md). Tools use declarative operation descriptors defined with `defineTool()` and are registered automatically from `src/operations/<toolset>/`.

## Testing

### Automated tests

Run the test suite with coverage:

```sh
pnpm test
```

Coverage thresholds require at least 80% lines and branches overall, and 90% for `src/core`.

### Live tests

Live tests hit the real Discord API and are opt-in. They require your own bot token and test server (guild). Configure them via environment variables:

- `DISCORD_TOKEN`: your test bot token
- `DISCORD_TEST_GUILD_ID`: your test guild ID
- `DISCORD_LIVE_TESTS=1`

Never run live tests against production servers or guilds with real user data. Live tests create only run-owned resources and clean them up upon completion. Never commit tokens, credentials, or test guild IDs.

## Verification checklist

Before opening a pull request, run the full verification sequence:

```sh
pnpm install --frozen-lockfile && pnpm biome check --write . && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm tools:manifest && pnpm docs:tools && pnpm coverage:sync && pnpm coverage:report && pnpm coverage:check
```

All commands must exit cleanly with zero errors and zero lint warnings.

## Pull request expectations

- Branch naming: `feat/<toolset>-<task>`, `fix/<scope>-<task>`, or `chore/<scope>-<task>`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`). Do not include AI co-author or attribution lines.
- One pull request per task or logical change.
- Never force push to `main`.
- Never commit credentials, tokens, or private guild details.
