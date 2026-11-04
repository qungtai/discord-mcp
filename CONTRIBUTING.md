# Contributing

Thank you for contributing to `@qungtai/discord-mcp`.

## Prerequisites

- Node.js >= 22 (pinned in `engines` in `package.json`). On Node 25 or later, first run `npm install -g corepack`.
- Corepack enabled (`corepack enable`)
- pnpm (managed by corepack via `packageManager` in `package.json`)

## Getting started

Clone the repository and install dependencies:

```sh
pnpm install
```

When checking out exact dependencies as committed in the lockfile, use `pnpm install --frozen-lockfile`.

## Adding a tool

Follow the tool specification and recipe in [docs/agent-tool-recipe.md](docs/agent-tool-recipe.md). Tools use declarative operation descriptors defined with `defineTool()` and are registered automatically from `src/operations/<toolset>/`.

## Testing

### Automated tests

Run the test suite with coverage:

```sh
pnpm test
```

Coverage thresholds require at least 80% lines and branches overall, and 90% for `src/core`.

### Live verification

Live verification hits the real Discord API. It is conducted with your own test bot token and test server (guild):

1. Set `DISCORD_TOKEN` to your test bot token.
2. Run the built server (`pnpm build && node dist/index.js` or via your MCP client).
3. Execute actions against your test guild and read the end state back using retrieval tools (such as `discord_get_message` or `discord_get_guild`) to confirm modifications.

Never run live tests against production servers or guilds with real user data. Create only run-owned resources and clean them up upon completion. Never commit tokens, credentials, or private guild IDs.

## Verification checklist

Before opening a pull request, run the full verification sequence:

```sh
pnpm install --frozen-lockfile && pnpm biome check --write . && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm tools:manifest && pnpm docs:tools && pnpm coverage:sync && pnpm coverage:report && pnpm coverage:check
```

All commands must exit cleanly with zero errors and zero lint warnings.

## Release workflow

Releases are published through GitHub Actions (`.github/workflows/release.yml`):

- **Automated tag release**: Pushing a version tag `v*.*.*` runs verification, publishes to npm with provenance, builds and pushes multi-arch Docker images to GHCR, and publishes to the official MCP Registry via `mcp-publisher` authenticated with GitHub Actions OIDC (`github-oidc`).
- **MCP Registry re-publish**: If needed to publish a version that is on npm but missing from the registry (for example after a failed registry job), run the `Release` workflow manually (`workflow_dispatch`) against `main`. It runs verification and registry publishing without repeating npm or Docker steps, guarded by a check ensuring the version in `package.json` and `server.json` is already published on npm.

## Pull request expectations

- Branch naming: `feat/<toolset>-<task>`, `fix/<scope>-<task>`, or `chore/<scope>-<task>`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`). Do not include AI co-author or attribution lines.
- One pull request per task or logical change.
- Never force push to `main`.
- Never commit credentials, tokens, or private guild details.
