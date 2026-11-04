# discord-mcp

[![npm version](https://img.shields.io/npm/v/@qungtai/discord-mcp)](https://www.npmjs.com/package/@qungtai/discord-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

A community Model Context Protocol (MCP) server for the Discord REST API.

<!-- summary:start -->
- 137 tools across core, messages, reactions, threads, channels, webhooks, guild, members, roles, moderation, events, invites.
- 141 of the 250 stable Discord API operations are implemented (see [docs/coverage.md](docs/coverage.md)); 123 are verified against a live server and 18 against mocked contracts.
<!-- summary:end -->
- File uploads and downloads with sandboxed directory boundaries and SHA-256 integrity checks.
- Approval before destructive actions through MCP elicitation.
- Guild allowlists, read-only mode, and toolset selection.
- Tokens never appear in tool arguments, outputs, or log streams.

## Status

0.1.0, early release. Available on npm as @qungtai/discord-mcp; MCP Registry name io.github.qungtai/discord-mcp.

## Quick start

### 1. Create a Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select New Application.
2. Go to the Bot tab, select Reset Token, and copy the bot token to a secure location.
3. Under Privileged Gateway Intents, enable Message Content intent (required to read message text) and Server Members intent (required for member listing and search). Do not enable Presence intent; this server uses the REST API and does not connect to the Gateway.
4. Go to OAuth2 > URL Generator. Select the `bot` scope, then select the permissions your tools need (see the [Toolsets](#toolsets) section below for per-toolset requirements and permission integers). In the generated invite URL, specify permissions with `permissions=<integer>` (for example, `https://discord.com/oauth2/authorize?client_id=<application_id>&scope=bot&permissions=2815162084228096` for the default toolsets). The Developer Portal displays permissions with spaces (such as "Send Messages" or "Manage Channels"). If managing roles or members, ensure the bot's highest role in Discord Server Settings > Roles sits above any role it manages. Open the invite URL in your browser to invite the bot to your server.
5. In your Discord client, open User Settings > Advanced and enable Developer Mode. Right-click your server icon in the sidebar and choose Copy Server ID.

### 2. Standard configuration

Add the server to your MCP client configuration:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

Recommended: add `DISCORD_MCP_ALLOWED_GUILDS` to `env`, set to your server ID from step 5, so the bot can act only in that server.

```json
"DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
```

Enable more toolsets with [`DISCORD_MCP_TOOLSETS`](#configuration). Restrict uploads to specific folders with [`DISCORD_MCP_FILE_ROOTS`](#configuration). Set [`DISCORD_MCP_DOWNLOAD_DIR`](#configuration) for downloads.

### 3. Client setup

<details>
<summary>Claude Code</summary>

Add via the CLI (defaults to local project scope; add `-s user` for all projects):

```sh
claude mcp add discord -e DISCORD_TOKEN="your-bot-token" -- npx -y @qungtai/discord-mcp
```

Or configure manually in `~/.claude.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

</details>

<details>
<summary>Claude Desktop</summary>

Edit the configuration file for your operating system:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json` (unofficial builds)

Add the server block:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

</details>

<details>
<summary>Codex</summary>

Add via the CLI:

```sh
codex mcp add discord --env DISCORD_TOKEN="your-bot-token" -- npx -y @qungtai/discord-mcp
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.discord]
command = "npx"
args = ["-y", "@qungtai/discord-mcp"]

[mcp_servers.discord.env]
DISCORD_TOKEN = "your-bot-token"
```

</details>

<details>
<summary>Cursor</summary>

Add to `.cursor/mcp.json` or configure in Cursor Settings > MCP:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

</details>

<details>
<summary>VS Code</summary>

Configure in `.vscode/mcp.json` with an input variable for the bot token:

```json
{
  "servers": {
    "discord": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "${input:discordToken}"
      }
    }
  },
  "inputs": [
    {
      "id": "discordToken",
      "type": "promptString",
      "description": "Discord Bot Token",
      "password": true
    }
  ]
}
```

</details>

<details>
<summary>MCP Inspector</summary>

Run the inspector:

```sh
npx @modelcontextprotocol/inspector -- npx -y @qungtai/discord-mcp
```

Set `DISCORD_TOKEN` in the inspector environment panel before connecting.

</details>

<details>
<summary>Install with Docker</summary>

Run the server with Docker:

```sh
docker run -i --rm -e DISCORD_TOKEN="your-bot-token" -v /path/to/downloads:/home/node/Downloads/discord-mcp -v /path/to/uploads:/uploads ghcr.io/qungtai/discord-mcp:latest
```

When using file tools, mount host directories with `-v host_path:container_path` so uploads and downloads are accessible outside the container. Upload paths passed to tools must be container paths. On Linux bind mounts, pass `--user "$(id -u):$(id -g)" -e DISCORD_MCP_DOWNLOAD_DIR=/home/node/Downloads/discord-mcp` if container user permissions prevent writing to the mounted host directories.

Configure in your MCP client (on Linux with custom `--user`, also add `-e DISCORD_MCP_DOWNLOAD_DIR=/home/node/Downloads/discord-mcp` to args):

```json
{
  "mcpServers": {
    "discord": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "DISCORD_TOKEN",
        "-v",
        "/path/to/downloads:/home/node/Downloads/discord-mcp",
        "-v",
        "/path/to/uploads:/uploads",
        "ghcr.io/qungtai/discord-mcp:latest"
      ],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

</details>

## Example prompts

To run these prompts, enable the toolset each prompt needs with `DISCORD_MCP_TOOLSETS` (for example, `DISCORD_MCP_TOOLSETS="core,messages,threads,members,events,webhooks"`).

- "Summarize the last 50 messages in channel 123456789012345678." (messages toolset)
- "Post an announcement to channel 123456789012345678 with release notes and attach `/Users/name/Downloads/banner.png`." (messages toolset)
- "Create a private thread named 'incident-402' in channel 123456789012345678 and add user 987654321098765432." (threads toolset)
- "List all guild members who currently have role 555666777888999000." (members toolset)
- "Schedule an upcoming community call event named 'Sprint Planning' starting tomorrow at 18:00 UTC in stage channel 123456789012345678." (events toolset)
- "Send a release notification using webhook 111222333444555666 with the custom username 'Deploy Bot'." (webhooks toolset)

## Toolsets

<!-- tools:start -->
| Toolset    | Default | Tools | What it covers                                                        | Bot permissions                                                                                                                                                                              |
| ---------- | ------- | ----: | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core       | Yes     |     6 | Current bot user, user lookup, guild list and leave, user connections | None                                                                                                                                                                                         |
| messages   | Yes     |    15 | Send, get, edit, delete, pin, search messages, polls, attachments     | AttachFiles, EmbedLinks, ManageMessages, MentionEveryone, PinMessages, ReadMessageHistory, SendMessages, SendMessagesInThreads, SendPolls, SendTTSMessages, UseExternalStickers, ViewChannel |
| reactions  | No      |     6 | Add, remove, list reactions on messages                               | AddReactions, ManageMessages, ReadMessageHistory, UseExternalEmojis, ViewChannel                                                                                                             |
| threads    | No      |    13 | Create, list, join, leave, archive threads and thread members         | CreatePrivateThreads, CreatePublicThreads, EmbedLinks, ManageThreads, ReadMessageHistory, SendMessages, SendMessagesInThreads, ViewChannel                                                   |
| channels   | No      |    13 | Create, edit, delete channels, permission overwrites, voice status    | Connect, ManageChannels, ManageRoles, ManageThreads, ManageWebhooks, SetVoiceChannelStatus, ViewChannel                                                                                      |
| webhooks   | No      |    10 | Create, edit, delete, execute webhooks and edit webhook messages      | ManageWebhooks                                                                                                                                                                               |
| guild      | No      |    22 | Guild settings, audit log, onboarding, welcome screen, widget         | ManageGuild, ManageRoles, ViewAuditLog                                                                                                                                                       |
| members    | No      |    12 | List, search, update, kick, mute, deafen members, prune               | ChangeNickname, Connect, DeafenMembers, KickMembers, ManageGuild, ManageNicknames, ManageRoles, ModerateMembers, MoveMembers, MuteMembers                                                    |
| roles      | No      |     7 | Create, update, delete, list guild roles, role member counts          | ManageRoles                                                                                                                                                                                  |
| moderation | No      |    10 | Ban, unban, list bans, AutoMod rules                                  | BanMembers, ManageGuild, ModerateMembers                                                                                                                                                     |
| events     | No      |    11 | Create, update, delete scheduled events and list subscribers          | CreateEvents, ManageEvents                                                                                                                                                                   |
| invites    | No      |    12 | Create, get, delete invites, guild/channel invites, target users      | CreateInstantInvite, ManageChannels, ManageGuild, ManageRoles                                                                                                                                |

Default is `core,messages`. Enable more toolsets with `DISCORD_MCP_TOOLSETS` (comma-separated).

Permissions integer for the default toolsets: `2815162084228096`.
Permissions integer for all implemented toolsets: `3115458644933879`.

<details>
<summary>core (6 tools)</summary>

- `discord_get_my_user`: Get the current bot user
- `discord_get_user`: Get a user by ID
- `discord_leave_guild`: Leave a guild (asks for approval)
- `discord_list_my_connections`: List the bot user's connections
- `discord_list_my_guilds`: List the guilds the bot is a member of. Page with after=next_after. Under DISCORD_MCP_ALLOWED_GUILDS, paging is not available; every allowed guild is returned in one call.
- `discord_update_my_user`: Update the current bot's username, avatar, or banner (asks for approval)

</details>

<details>
<summary>messages (15 tools)</summary>

- `discord_bulk_delete_messages`: Delete multiple messages (2-100, younger than 14 days) at once from a channel (asks for approval)
- `discord_create_pin`: Pin a message in a channel
- `discord_crosspost_message`: Crosspost (publish) a message in an announcement channel to following channels
- `discord_delete_message`: Delete a message from a channel (asks for approval)
- `discord_delete_pin`: Unpin a message in a channel
- `discord_download_attachment`: Download a message attachment into DISCORD_MCP_DOWNLOAD_DIR
- `discord_edit_message`: Edit a message's content, embeds and attachment metadata, or add attachments
- `discord_end_poll`: Immediately end a poll on a message
- `discord_get_message`: Get a message
- `discord_list_messages`: List messages, newest first. Page with before=next_before
- `discord_list_pins`: List pinned messages in a channel
- `discord_list_poll_answer_voters`: Get a list of users that voted for a specific poll answer
- `discord_search_guild_messages`: Search messages across a guild. Page with offset=next_offset
- `discord_send_message`: Send a message
- `discord_trigger_typing_indicator`: Trigger the typing indicator in a channel

</details>

<details>
<summary>reactions (6 tools)</summary>

- `discord_add_my_message_reaction`: Add a reaction to a message as the current user
- `discord_delete_all_message_reactions`: Delete all reactions on a message (asks for approval)
- `discord_delete_all_message_reactions_by_emoji`: Delete all reactions for a given emoji on a message (asks for approval)
- `discord_delete_my_message_reaction`: Delete the current user's reaction from a message
- `discord_delete_user_message_reaction`: Delete another user's reaction from a message (asks for approval)
- `discord_list_message_reactions_by_emoji`: Get a list of users that reacted with a given emoji

</details>

<details>
<summary>threads (13 tools)</summary>

- `discord_add_thread_member`: Add a user to a thread
- `discord_create_thread`: Create a new thread in a channel without an existing message (or start a forum post if message is provided). Defaults to private thread (type 12) if type is omitted in text channels; invitable only applies to private threads.
- `discord_create_thread_from_message`: Create a new thread from an existing message in a channel
- `discord_delete_thread_member`: Remove a user from a thread (asks for approval)
- `discord_get_thread_member`: Get a member of a thread by user ID
- `discord_join_thread`: Add the current user to a thread
- `discord_leave_thread`: Remove the current user from a thread
- `discord_list_active_guild_threads`: Get all active threads in a guild, including public and private threads
- `discord_list_my_private_archived_threads`: List private archived threads that the bot has joined in a channel. Page with before=next_before
- `discord_list_private_archived_threads`: List private archived threads in a channel. Page with before=next_before
- `discord_list_public_archived_threads`: List public archived threads in a channel. Page with before=next_before
- `discord_list_thread_members`: List members of a thread. Note: after and limit pagination only apply when with_member is true and the bot has GUILD_MEMBERS intent. Page with after=next_after
- `discord_search_threads`: Search threads in a channel. A new thread can take about 30 seconds to appear in results. Page with offset=next_offset

</details>

<details>
<summary>channels (13 tools)</summary>

- `discord_bulk_update_guild_channels`: Modify the positions of a set of channels for the guild (asks for approval)
- `discord_create_dm`: Open a direct message channel with a user
- `discord_create_guild_channel`: Create a new channel in a guild (asks for approval)
- `discord_delete_channel`: Delete a channel, or close a private message (asks for approval)
- `discord_delete_channel_permission_overwrite`: Delete a permission overwrite for a channel (asks for approval)
- `discord_follow_channel`: Follow an announcement channel to send messages to a target channel
- `discord_get_channel`: Get a channel by ID
- `discord_get_member_permissions`: Get computed guild or channel member permissions
- `discord_get_role_permissions`: Get computed guild or channel role permissions
- `discord_list_guild_channels`: List channels in a guild
- `discord_set_channel_permission_overwrite`: Set or update permission overwrite for a channel (asks for approval)
- `discord_update_channel`: Update a channel's settings (asks for approval)
- `discord_update_voice_channel_status`: Set or clear a voice channel status (asks for approval)

</details>

<details>
<summary>webhooks (10 tools)</summary>

- `discord_create_webhook`: Create a new webhook in a channel
- `discord_delete_webhook`: Delete a webhook permanently (asks for approval)
- `discord_delete_webhook_message`: Delete a message previously sent by a webhook (asks for approval)
- `discord_edit_webhook_message`: Edit a message previously sent by a webhook (asks for approval)
- `discord_execute_webhook`: Execute a webhook to send a message (asks for approval)
- `discord_get_webhook`: Get a webhook by ID
- `discord_get_webhook_message`: Get a message previously sent by a webhook
- `discord_list_channel_webhooks`: List webhooks in a channel
- `discord_list_guild_webhooks`: List webhooks in a guild
- `discord_update_webhook`: Update a webhook's name, avatar, or move it to a different channel (asks for approval)

</details>

<details>
<summary>guild (22 tools)</summary>

- `discord_create_guild_template`: Create a new template from an existing guild snapshot. Discord permits only one template per guild; creating another fails unless the existing one is deleted. To list existing templates use discord_list_guild_templates. Returns the created template object including its unique code.
- `discord_delete_guild_integration`: Delete an integration from a guild. Discord also deletes the webhooks tied to it and kicks the associated bot, if there is one. This cannot be undone. Find integration IDs with discord_list_guild_integrations. Returns the guild and integration IDs. (asks for approval)
- `discord_delete_guild_template`: Delete a template from a guild by template code. Because Discord allows only one template per guild, deleting the existing template permits creating a new snapshot. To inspect the template before deleting use discord_get_guild_template. Returns the deleted template object. (asks for approval)
- `discord_get_guild`: Fetch detailed information for a guild by ID that the bot currently belongs to. To view basic discoverable information without bot membership use discord_get_guild_preview, and to list all guilds the bot belongs to use discord_list_my_guilds. Returns the full guild object including owner ID, features, verification level, and optional counts.
- `discord_get_guild_new_member_welcome`: Retrieve the new member welcome experience (Home tab settings) for a guild. This feature requires Community to be enabled on the guild. To inspect full onboarding questions use discord_get_guild_onboarding, or use discord_get_guild_welcome_screen for legacy welcome screens. Returns welcome settings or null when unconfigured.
- `discord_get_guild_onboarding`: Retrieve the onboarding setup of a guild: prompts with their options, default channels, whether onboarding is enabled, and the mode. Onboarding is a Community server feature. To change it use discord_update_guild_onboarding. Returns the onboarding object.
- `discord_get_guild_preview`: Fetch the public preview of a guild: name, icon, splash, emoji, stickers, features and approximate member and presence counts. If the bot is not a member, the guild must have the DISCOVERABLE feature. For full details of a guild the bot is in use discord_get_guild.
- `discord_get_guild_template`: Fetch a guild template by its unique template code without requiring guild membership. Each guild can have at most one template. To list templates belonging to a specific guild use discord_list_guild_templates. Returns the template details including serialized guild structure and usage count.
- `discord_get_guild_vanity_url`: Retrieve the custom vanity URL invite code and usage statistics for a guild. Vanity URLs need a Community server with the VANITY_URL feature, usually unlocked by Server Boost Level 3. To inspect regular guild invites use discord_list_guild_invites. Returns the vanity code (null when none is set) and its use count.
- `discord_get_guild_welcome_screen`: Retrieve the welcome screen of a guild: its description and up to 5 featured channels. The welcome screen is a Community server feature. To change it use discord_update_guild_welcome_screen. Returns the welcome screen object.
- `discord_get_guild_widget`: Fetch public widget JSON data for a guild, including active voice channels and online members. Requires the guild widget to be enabled in widget settings. To view or toggle widget configuration use discord_get_guild_widget_settings or discord_update_guild_widget_settings. Returns public widget info including channel list and online presence count.
- `discord_get_guild_widget_settings`: Retrieve widget settings for a guild, indicating whether the embeddable widget is enabled and which channel it binds to. To read the rendered widget payload with member presences use discord_get_guild_widget. To toggle the widget or change its invite channel use discord_update_guild_widget_settings. Returns whether the widget is enabled and its channel ID.
- `discord_list_guild_audit_log_entries`: List audit log entries for a guild, newest first. Filter by user_id (who acted), target_id (what was changed) or action_type, and return 1 to 100 entries per call (default 50). Page to older entries with before=next_before; next_after is the newest entry ID on the page. Returns audit_log_entries plus the related users, integrations, webhooks, threads and scheduled events.
- `discord_list_guild_integrations`: List all attached integrations for a guild, including bots, Twitch, and YouTube connections. To remove an integration use discord_delete_guild_integration. To inspect audit log events generated by integrations use discord_list_guild_audit_log_entries. Returns an array of integration objects with enabled statuses and types.
- `discord_list_guild_templates`: List templates created for a specific guild. Because Discord enforces a limit of one template per guild, this endpoint returns an array containing at most one template. To sync a template after guild changes use discord_sync_guild_template, or to create one use discord_create_guild_template. Returns the list of template objects.
- `discord_sync_guild_template`: Synchronize an existing template with the current state and structure of the guild. A guild can have at most one template; when the source guild changes, the template becomes out of sync until updated here. To view or check template dirty state use discord_list_guild_templates. Returns the updated template object. (asks for approval)
- `discord_update_guild`: Change settings of a guild: name, icon and banner images, verification and notification levels, AFK and system channels, rules and updates channels, locale, description and feature list. Only fields you send change. rules_channel_id and public_updates_channel_id apply to Community servers, and each image needs its guild feature (see the field). To read current values first use discord_get_guild. Returns the updated guild object. (asks for approval)
- `discord_update_guild_incident_actions`: Pause or resume guild invites and direct messages during raid or security incidents. Timestamps must be future ISO 8601 strings up to 24 hours, or null to clear restrictions immediately. To audit raid mitigation actions use discord_list_guild_audit_log_entries. Returns the updated incident actions status. (asks for approval)
- `discord_update_guild_onboarding`: Replace the onboarding setup of a guild: prompts with options, default channels, enabled flag and mode. Onboarding is a Community server feature. When enabled, Discord requires at least 7 default channels, at least 5 of which allow @everyone to send messages; mode 0 counts only default channels, mode 1 also counts prompts. Read the current setup first with discord_get_guild_onboarding. Returns the updated onboarding object. (asks for approval)
- `discord_update_guild_template`: Update name and description metadata for an existing guild template. Each guild supports only one template; updating metadata does not sync channels or roles. To synchronize template structure with server changes use discord_sync_guild_template. Returns the updated template object. (asks for approval)
- `discord_update_guild_welcome_screen`: Update the welcome screen configuration and recommended channels shown to new members. This feature requires Community to be enabled on the guild. To inspect current welcome screen settings use discord_get_guild_welcome_screen. Returns the updated welcome screen object. (asks for approval)
- `discord_update_guild_widget_settings`: Update widget configuration for a guild to enable or disable the widget and set its invite channel. To inspect current widget settings before modifying use discord_get_guild_widget_settings, or fetch the live JSON widget via discord_get_guild_widget. Returns the updated widget settings. (asks for approval)

</details>

<details>
<summary>members (12 tools)</summary>

- `discord_add_guild_member_role`: Add a role to a guild member (asks for approval)
- `discord_delete_guild_member`: Remove (kick) a member from a guild (asks for approval)
- `discord_delete_guild_member_role`: Remove a role from a guild member (asks for approval)
- `discord_get_guild_member`: Get a guild member by user ID
- `discord_list_guild_join_requests`: List join requests for a guild, optionally filtered by application status
- `discord_list_guild_members`: List guild members. Requires the Server Members privileged Gateway intent (GUILD_MEMBERS). Page with after=next_after
- `discord_preview_prune_guild`: Get the number of members that would be removed in a prune operation
- `discord_prune_guild`: Begin a prune operation to remove inactive members from a guild (asks for approval)
- `discord_review_guild_join_request`: Approve or reject a guild join request. rejection_reason is only used when action is REJECTED (asks for approval)
- `discord_search_guild_members`: Search guild members whose username or nickname starts with the query. Requires the Server Members privileged Gateway intent (GUILD_MEMBERS)
- `discord_update_guild_member`: Update attributes of a guild member. Discord refuses edits to the bot itself here; discord_update_my_guild_member changes the bot's own nickname. channel_id moves the member to a voice channel; null disconnects them (asks for approval)
- `discord_update_my_guild_member`: Update the current bot's nickname or member profile in a guild

</details>

<details>
<summary>roles (7 tools)</summary>

- `discord_bulk_update_guild_roles`: Change the position of several roles in one call. Send only the roles to move; Discord shifts the others to make room. A higher position ranks higher in the hierarchy, and @everyone stays at position 0. The bot can only reorder roles below its own highest role. To see the current order use discord_list_guild_roles. Returns every role in the guild. (asks for approval)
- `discord_create_guild_role`: Create a new role in a guild with customized name, permissions bitfield, color, hoist, and icon settings. Under role hierarchy rules, the bot can only grant permissions it currently holds. Newly created roles are placed just above the @everyone role. To list existing roles use discord_list_guild_roles. Returns the created role object. (asks for approval)
- `discord_delete_guild_role`: Delete a role from a guild by role ID. Under role hierarchy rules, the bot can only delete roles positioned strictly below the bot highest role; managed integration roles and the @everyone role cannot be deleted. To remove a role from a specific member instead use discord_delete_guild_member_role. Returns confirmation with deleted IDs. (asks for approval)
- `discord_get_guild_role`: Fetch a single role by role ID within a guild. To list all roles belonging to the guild at once use discord_list_guild_roles. To view channel-specific permissions computed for a role use discord_get_role_permissions. Returns the complete role object including name, color, hoist status, position, and permission bits.
- `discord_get_guild_role_member_counts`: Count the members that hold each role in a guild, without fetching every member. To list the full metadata of each role use discord_list_guild_roles. Returns a mapping of role ID snowflakes to integer member counts.
- `discord_list_guild_roles`: List every role configured in a guild, including @everyone, bot integration roles, and booster roles. To fetch member counts across roles use discord_get_guild_role_member_counts, or to create a new role use discord_create_guild_role. Returns every role object, each with its position.
- `discord_update_guild_role`: Update settings, name, permissions bitfield, color, hoist, and icon for an existing guild role. Under Discord role hierarchy rules, the bot can only modify roles positioned strictly below its highest role and cannot grant permissions it does not possess. To modify role ordering instead use discord_bulk_update_guild_roles. Returns the updated role object. (asks for approval)

</details>

<details>
<summary>moderation (10 tools)</summary>

- `discord_ban_user_from_guild`: Ban a user from a guild and optionally delete their messages (asks for approval)
- `discord_bulk_ban_users_from_guild`: Ban up to 200 users from a guild and optionally delete their messages (asks for approval)
- `discord_create_auto_moderation_rule`: Create an auto moderation rule for a guild (asks for approval)
- `discord_delete_auto_moderation_rule`: Delete an auto moderation rule for a guild (asks for approval)
- `discord_get_auto_moderation_rule`: Get a specific auto moderation rule for a guild
- `discord_get_guild_ban`: Get ban information for a user in a guild
- `discord_list_auto_moderation_rules`: List all auto moderation rules for a guild
- `discord_list_guild_bans`: List bans in ascending user ID order. Page with after=next_after
- `discord_unban_user_from_guild`: Remove the ban for a user in a guild (asks for approval)
- `discord_update_auto_moderation_rule`: Modify an existing auto moderation rule for a guild (asks for approval)

</details>

<details>
<summary>events (11 tools)</summary>

- `discord_count_guild_scheduled_event_users`: Get user counts for a guild scheduled event and its exceptions
- `discord_create_guild_scheduled_event`: Create a scheduled event for a guild
- `discord_create_guild_scheduled_event_exception`: Create an exception for a recurring guild scheduled event
- `discord_delete_guild_scheduled_event`: Delete a guild scheduled event (asks for approval)
- `discord_delete_guild_scheduled_event_exception`: Delete an exception for a recurring guild scheduled event (asks for approval)
- `discord_get_guild_scheduled_event`: Get a guild scheduled event by ID
- `discord_list_guild_scheduled_event_exception_users`: Get a list of users subscribed to a specific recurrence exception of a guild scheduled event, ordered by user ID ascending. Page with after=next_after
- `discord_list_guild_scheduled_event_users`: Get a list of users subscribed to a guild scheduled event, ordered by user ID ascending. Page with after=next_after
- `discord_list_guild_scheduled_events`: List scheduled events for a guild
- `discord_update_guild_scheduled_event`: Modify a guild scheduled event (asks for approval)
- `discord_update_guild_scheduled_event_exception`: Modify an exception for a recurring guild scheduled event (asks for approval)

</details>

<details>
<summary>invites (12 tools)</summary>

- `discord_add_invite_target_user`: Add a target user to an existing invite (asks for approval)
- `discord_bulk_add_invite_target_users`: Add multiple target users to an existing invite (asks for approval)
- `discord_bulk_delete_invite_target_users`: Remove multiple target users from an existing invite (asks for approval)
- `discord_create_channel_invite`: Create a new invite for a channel (asks for approval)
- `discord_delete_invite`: Delete an invite by its code (asks for approval)
- `discord_delete_invite_target_user`: Remove a target user from an existing invite (asks for approval)
- `discord_get_invite`: Get an invite by its code. Under an allowlist, setting target_message_id requires target_channel_id so the message can be checked.
- `discord_get_invite_target_users_job_status`: Get the target users job status for an invite
- `discord_list_channel_invites`: Get all active invites for a channel
- `discord_list_guild_invites`: Get all active invites for a guild
- `discord_list_invite_target_users`: Get the target users for an invite. The response is returned as CSV text in the csv field.
- `discord_set_invite_target_users`: Set the target users for an invite using a CSV file. (asks for approval)

</details>
<!-- tools:end -->

## Configuration

| Variable                         | Default                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`                  | _required_                | Discord bot authentication token.                                                                                                                                                                                                                                                                                                                                                                                                |
| `DISCORD_MCP_ALLOWED_GUILDS`     | _(empty)_                 | Comma-separated list of allowed guild IDs. When set, operations outside these guilds are refused.                                                                                                                                                                                                                                                                                                                                |
| `DISCORD_MCP_ALLOW_DMS`          | `false`                   | Permits direct messages and user-scoped operations alongside an active guild allowlist (`true` or `false`). Any other value stops startup.                                                                                                                                                                                                                                                                                       |
| `DISCORD_MCP_TOOLSETS`           | `core,messages`           | Comma-separated list of enabled toolsets. <!-- config-toolsets:start --> Available: core, messages, reactions, threads, channels, webhooks, guild, members, roles, moderation, events, invites. <!-- config-toolsets:end -->                                                                                                                                                                                                     |
| `DISCORD_MCP_READ_ONLY`          | `false`                   | Blocks all mutating actions and allows read-only tools only (`true` or `false`). Any other value stops startup.                                                                                                                                                                                                                                                                                                                  |
| `DISCORD_MCP_APPROVAL`           | `elicitation`             | Confirmation mode for destructive operations (`elicitation` or `none`). Any other value stops startup.                                                                                                                                                                                                                                                                                                                           |
| `DISCORD_MCP_FILE_ROOTS`         | _(empty)_                 | Optional comma-separated list of directory paths accessible for uploads; a leading `~/` is expanded with the user home directory. When unset, empty, or parsing to no entries, file access is open by default for any absolute path, except hidden files and directories, system paths (`/proc`, `/sys`, `/dev`), and application configuration directories (`~/Library` on macOS, `%APPDATA%` and `%LOCALAPPDATA%` on Windows). |
| `DISCORD_MCP_DOWNLOAD_DIR`       | `~/Downloads/discord-mcp` | Directory path where attachment downloads are stored; a leading `~/` is expanded with the user home directory. Defaults to `~/Downloads/discord-mcp` and is created recursively on first download.                                                                                                                                                                                                                               |
| `DISCORD_MCP_REQUEST_TIMEOUT_MS` | `15000`                   | HTTP request timeout in milliseconds for Discord REST API requests.                                                                                                                                                                                                                                                                                                                                                              |
| `DISCORD_MCP_RATE_LIMIT_WAIT_MS` | `5000`                    | Maximum wait duration in milliseconds when encountering a Discord rate limit before aborting.                                                                                                                                                                                                                                                                                                                                    |
| `DISCORD_MCP_MAX_UPLOAD_BYTES`   | `20971520`                | Maximum upload size in bytes (defaults to 20 MiB).                                                                                                                                                                                                                                                                                                                                                                               |
| `DISCORD_MCP_MAX_DOWNLOAD_BYTES` | `104857600`               | Maximum download size in bytes for `discord_download_attachment` (defaults to 100 MiB).                                                                                                                                                                                                                                                                                                                                          |

## Safety

### Guild allowlists and DM policies

- `DISCORD_MCP_ALLOWED_GUILDS`: Limits all bot operations to specific guild IDs. Any operation targeting a guild not on the allowlist is rejected.
- Non-guild resources that are not DMs (such as application-level webhooks and friend invites) are refused when a guild allowlist is active, regardless of `DISCORD_MCP_ALLOW_DMS`.
- `discord_list_my_guilds` returns all allowed guilds in one response and rejects pagination parameters (`before`, `after`, `limit`) when an allowlist is configured.
- With a guild allowlist, direct messages and user-scoped operations require `DISCORD_MCP_ALLOW_DMS=true`.

### Approval through elicitation

Tools marked "asks for approval" require confirmation using MCP elicitation (`elicitation/create`). Destructive operations default to requiring approval, with six exceptions:
- `discord_edit_message`: Editing the bot's own message replaces content without removing other users' history, so it needs no approval.
- `discord_end_poll`: Discord only permits the poll author to end a poll, so this can only end the bot's own poll.
- `discord_delete_pin`: Unpinning is reversible and removes no message content.
- `discord_delete_my_message_reaction`: Removing the bot's own reaction affects only the bot's own state.
- `discord_leave_thread`: Leaving a public thread removes only the bot's own membership.
- `discord_update_my_guild_member`: Editing the bot's own guild member profile affects only the bot's own nickname, avatar, and banner.

The server requires the client to advertise `elicitation.form`. Only Claude Code and Codex were verified. Claude Desktop, Cursor, and VS Code are untested.

- Claude Code displays the elicitation dialog and proceeds upon user approval.
- Codex in on-request approval mode (`codex -a on-request`) displays the confirmation prompt. In full-access mode, Codex declines elicitation requests automatically and the tool returns "Approval declined".
- When using clients without MCP elicitation support, set `DISCORD_MCP_APPROVAL=none` to bypass server-side elicitation and rely on your client's native tool execution confirmations. Without elicitation, destructive tools are refused with a policy error naming `DISCORD_MCP_APPROVAL=none`.
- When `DISCORD_MCP_APPROVAL=none` is set, server-side approval for destructive tools is disabled. The server outputs a warning notice to stderr at startup.

### Read-only mode

Setting `DISCORD_MCP_READ_ONLY=true` rejects all mutating tools (writes and destructive actions) at the pipeline level.

### Filesystem boundaries

- Uploads: File access is open by default. When `DISCORD_MCP_FILE_ROOTS` is unset or empty, tools that attach files can read any absolute path except hidden files and directories (paths containing a component that starts with `.`), system paths under `/proc`, `/sys`, or `/dev`, and application configuration directories (`~/Library` on macOS, `%APPDATA%` and `%LOCALAPPDATA%` on Windows). Open-mode rules defend against prompt injection from channel content attempting to leak credentials. Hardlinks to files in these directories and non-dot-named secrets elsewhere are not detected. Uploads whose bytes contain the bot token are refused. To restrict uploads, set `DISCORD_MCP_FILE_ROOTS` to a comma-separated list of allowed directories. Inside explicit roots, hidden files are permitted. Relative paths and `..` segments are always refused. Checks run on both lexical and resolved realpath.
- Downloads: Attachments downloaded with `discord_download_attachment` are saved inside `DISCORD_MCP_DOWNLOAD_DIR` (defaults to `~/Downloads/discord-mcp`), created recursively on first download, with SHA-256 integrity verification. Downloads exceeding `DISCORD_MCP_MAX_DOWNLOAD_BYTES` (default 100 MiB) are refused before downloading or aborted while streaming.

### Credential protection

`DISCORD_TOKEN` is read directly from environment variables. The token is never passed as a tool argument, never returned in tool responses, and automatically redacted in logs and error traces.

## Development

### Install from source

Prerequisites: Node >= 22. On Node 25 or later, first run `npm install -g corepack`.

Clone the repository and install dependencies:

```sh
git clone https://github.com/qungtai/discord-mcp.git
cd discord-mcp
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Run the server with Node:

```sh
DISCORD_TOKEN="your-bot-token" node dist/index.js
```

### Client configuration for local builds

Get the absolute path to `dist/index.js` by running `pwd` inside the cloned repository (for example, `/Users/name/discord-mcp/dist/index.js`). Point your MCP client configuration at `dist/index.js`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/to/discord-mcp/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

### Verification

Run the full verification suite defined in [AGENTS.md](AGENTS.md).

For contribution guidelines and security disclosure policies, see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

Not affiliated with or endorsed by Discord Inc.
