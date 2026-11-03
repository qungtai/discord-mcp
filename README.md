# discord-mcp

A community MCP server for the Discord API with traceable, measured coverage of
Discord's documented HTTP surface. Every operation is tracked in a coverage
register (implementation, availability and verification are separate
dimensions) so coverage claims are evidence-based rather than tool-count based.

## Status

Pre-release. Unpublished. The package is not yet on npm and no Docker image or
MCP Registry entry exists. Install from source today (see below); the standard
`npx -y @qungtai/discord-mcp@<version>` install path will be available after the
first release.

## Features (planned by toolset)

Tool names are `discord_<verb>_<noun>` (snake_case parameters). Toolsets are
gated by `DISCORD_MCP_TOOLSETS` (default `core,messages`).

- core: current user (`discord_get_my_user`, `discord_update_my_user`), user lookup (`discord_get_user`), guilds (`discord_list_my_guilds`, `discord_leave_guild`), user connections (`discord_list_my_connections`), application, gateway info
- messages: list/fetch/send/edit/delete, bulk delete, search, pins, typing,
  polls, reactions (separate toolset), downloads
- threads: create, list, archive, members
- channels: CRUD, ordering, permission overwrites, effective permissions,
  voice channel status, DMs
- webhooks: CRUD, execute, webhook messages
- guild: settings, audit log, widget, onboarding, welcome screen, templates,
  integrations, incident actions, vanity URL
- members / roles: read, search, add, update, remove, roles, prune, join requests
- moderation: bans, AutoMod rules
- events: scheduled events and subscribers
- invites: create, get, delete, target users
- expressions: emojis, stickers, soundboard
- voice: regions, voice states, stage instances
- commands: application commands and permissions
- monetization: entitlements, SKU subscriptions
- oauth_user: connections, role connections, authorization info
- utility: server status, coverage report, operation discovery

See `docs/coverage.md` for the full pinned baseline and per-operation status.

## Required bot intents and permissions

Privileged intents (enable in the Discord Developer Portal as needed):

- `MESSAGE CONTENT` - reading message content in messages/threads toolsets
- `SERVER MEMBERS` - members, roles, moderation toolsets
- `PRESENCE` - only if presence features are used

Permissions are checked per operation (planned: reporting the missing
permission, scope, intent or Discord restriction). Discord remains
authoritative. A bot invite should grant only the permissions the selected
toolsets need (minimum-permission guide to be expanded in `docs/`).

## Safety settings

All controls are resolved from the environment inside the server. `DISCORD_TOKEN`
is never a tool argument and is never logged.

- `DISCORD_TOKEN` - bot token (required)
- `DISCORD_MCP_ALLOWED_GUILDS` - comma-separated guild IDs; empty means no
  restriction (planned: guild and channel allowlists across every access path)
- `DISCORD_MCP_ALLOW_DMS` - `true` or `false` (default `false`); controls whether
  direct messages (or user-scoped tools) are permitted when a guild allowlist is configured.
  A guild allowlist never implies DM access.
- `DISCORD_MCP_TOOLSETS` - comma-separated toolsets; default `core,messages`
  (planned: invalid or empty values fail closed to this default set)
- `DISCORD_MCP_READ_ONLY` - `true` blocks mutating tools (planned)
- `DISCORD_MCP_APPROVAL` - `elicitation` (default) prompts the user via MCP
  elicitation before running destructive operations; `none` disables server-side
  approval for destructive tools and relies on the client's native tool approval
  prompts instead (needed for clients without MCP elicitation support). The
  server prints a warning to stderr at startup in `none` mode.
- `DISCORD_MCP_FILE_ROOTS` - comma-separated absolute directories readable for
  uploads
- `DISCORD_MCP_DOWNLOAD_DIR` - absolute directory for downloads

DM access is a separate switch (`DISCORD_MCP_ALLOW_DMS`) and is not implied by a guild allowlist.
Permission and scope reporting for denied operations is planned.

## Install from source

```sh
pnpm install
pnpm build
DISCORD_TOKEN=... node dist/index.js
```

For client-specific stdio configuration see `docs/clients.md`.

## Documentation

- `docs/clients.md` - copy-paste client configurations
- `docs/coverage.md` - coverage report and pinned baseline
- `AGENTS.md` - repository rules (also `CLAUDE.md`)
