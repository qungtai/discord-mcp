# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Live evidence file (`coverage/live-evidence.json`) recording real Discord actions
  and outcomes, synced into the register by `pnpm coverage:sync`.
- Community documentation: README, client configurations, contributing guide,
  security policy, changelog and license.
- Webhooks toolset (10 tools): channel/guild webhook listing, creation, retrieval,
  modification, deletion, webhook execution with multipart attachment support,
  and webhook message retrieval, editing, and deletion.
- Core and channels user/DM tools: `discord_get_my_user`, `discord_update_my_user`,
  `discord_get_user`, `discord_list_my_guilds`, `discord_leave_guild`,
  `discord_list_my_connections` and `discord_create_dm`.
- DM policy switch (`DISCORD_MCP_ALLOW_DMS`, default `false`): a guild allowlist
  never implies DM access; direct messages and user-scoped operations require
  `DISCORD_MCP_ALLOW_DMS=true` when an allowlist is active.
- 137 Discord tools across twelve toolsets: channels (13), core (6), events (11),
  guild (22), invites (12), members (12), messages (15), moderation (10),
  reactions (6), roles (7), threads (13) and webhooks (10), registered from one
  operation descriptor each.
- Approval through MCP elicitation: destructive tools ask the user before they
  run, and `DISCORD_MCP_APPROVAL` selects `elicitation` or `none`. In `none` mode
  the server prints a warning at startup because server-side approval is off.
- Polls on `discord_send_message` (`poll` with question, 1-10 answers, duration,
  multiselect and layout), plus `tts`, the `SUPPRESS_EMBEDS` and
  `SUPPRESS_NOTIFICATIONS` flag bitfield and up to three `sticker_ids`.
- Message search, thread search with up to 20 tags, guild templates, join
  request review, scheduled event exceptions, auto moderation, onboarding,
  welcome screen, widget, new member welcome and voice status tools.

### Changed

- Tool manifest generation writes `coverage/tools.json`; explicit `coverage:sync`
  updates the committed register (`coverage/register.json`) from tools and live
  evidence, and `coverage:check` fails when tools.json is missing or when the
  committed register differs from sync output.
- Resource outputs are loose objects: every field Discord sends reaches the
  caller, so `discord_get_channel` now returns `permission_overwrites`, `nsfw`,
  `rate_limit_per_user` and future fields instead of dropping them. Input
  schemas stay strict.
- Array query parameters are sent as repeated keys (`?key=1&key=2`), including
  the scheduled event exception IDs, thread search tags and guild search
  filters.
- Tool names follow `discord_<verb>_<noun>` and a registry test enforces it.
  Renamed: `discord_poll_expire` to `discord_end_poll`,
  `discord_get_answer_voters` to `discord_list_poll_answer_voters`,
  `discord_guild_role_member_counts` to `discord_get_guild_role_member_counts`,
  `discord_thread_search` to `discord_search_threads`,
  `discord_get_guilds_onboarding` to `discord_get_guild_onboarding`,
  `discord_put_guilds_onboarding` to `discord_update_guild_onboarding`,
  `discord_action_guild_join_request` to `discord_review_guild_join_request`,
  `discord_get_guild_join_requests` to `discord_list_guild_join_requests` and
  `discord_get_active_guild_threads` to `discord_list_active_guild_threads`.
- `discord_create_guild_role`, `discord_add_guild_member_role`,
  `discord_create_channel_invite` and `discord_create_guild_channel` ask for
  approval because they can grant permissions.

### Fixed

- Clearable channel fields accept `null` again on `discord_update_guild`,
  `discord_update_guild_widget_settings`, `discord_update_guild_member` and
  `discord_update_guild_scheduled_event`.
- A route segment that decodes to `.` or `..` is refused before the request is
  sent, and the approval prompt truncates long argument values and redacts
  token-shaped strings.
