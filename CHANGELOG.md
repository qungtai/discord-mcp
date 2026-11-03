# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- CI workflow (`.github/workflows/ci.yml`) running lint, typecheck and tests.
- Community documentation: README, client configurations, contributing guide,
  security policy, changelog and license.
- 110 Discord tools across ten toolsets: channels (12), events (11), guild (22),
  invites (2), members (12), messages (15), moderation (10), reactions (6),
  roles (7) and threads (13), registered from one operation descriptor each.
- 10 invite operations in the invites toolset: resolve invite (`discord_get_invite`),
  revoke invite (`discord_delete_invite`), list guild invites (`discord_list_guild_invites`),
  target users CSV retrieval (`discord_list_invite_target_users`), target users CSV
  upload (`discord_set_invite_target_users`), target users job status
  (`discord_get_invite_target_users_job_status`), bulk add/delete target users
  (`discord_bulk_add_invite_target_users`, `discord_bulk_delete_invite_target_users`),
  and single target user add/delete (`discord_add_invite_target_user`, `discord_delete_invite_target_user`).
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
