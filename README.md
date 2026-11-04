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

- `discord_create_guild_template`: Create a template for a guild
- `discord_delete_guild_integration`: Delete an integration from a guild (asks for approval)
- `discord_delete_guild_template`: Delete a guild template (asks for approval)
- `discord_get_guild`: Get a guild by ID
- `discord_get_guild_new_member_welcome`: Get new member welcome (home settings) for a guild
- `discord_get_guild_onboarding`: Get the onboarding configuration for a guild
- `discord_get_guild_preview`: Get a guild's preview
- `discord_get_guild_template`: Get a guild template by its code
- `discord_get_guild_vanity_url`: Get the vanity URL code for a guild
- `discord_get_guild_welcome_screen`: Get the welcome screen for a guild
- `discord_get_guild_widget`: Get the widget data for a guild
- `discord_get_guild_widget_settings`: Get widget settings for a guild
- `discord_list_guild_audit_log_entries`: List audit log entries for a guild
- `discord_list_guild_integrations`: List integrations for a guild
- `discord_list_guild_templates`: List templates for a guild
- `discord_sync_guild_template`: Sync a guild template to the current state of the guild (asks for approval)
- `discord_update_guild`: Update guild settings (asks for approval)
- `discord_update_guild_incident_actions`: Update the time until invites or DMs are disabled for a guild (asks for approval)
- `discord_update_guild_onboarding`: Set the onboarding configuration for a guild (asks for approval)
- `discord_update_guild_template`: Update a guild template metadata (asks for approval)
- `discord_update_guild_welcome_screen`: Update the welcome screen for a guild (asks for approval)
- `discord_update_guild_widget_settings`: Update widget settings for a guild (asks for approval)

</details>

<details>
<summary>members (12 tools)</summary>

- `discord_add_guild_member_role`: Add a single role to a guild member. The bot cannot add roles ranked at or above its own highest role, nor can it modify the guild owner. To assign multiple roles at once or replace all roles, use discord_update_guild_member. (asks for approval)
- `discord_delete_guild_member`: Remove (kick) a member from a guild. The bot cannot kick the guild owner or any member whose highest role is equal to or higher than the bot's highest role. To ban a user and delete their message history instead, use discord_ban_user_from_guild. (asks for approval)
- `discord_delete_guild_member_role`: Remove a single role from a guild member. The bot cannot remove roles ranked at or above its own highest role, nor can it modify the guild owner. To assign a role instead use discord_add_guild_member_role. (asks for approval)
- `discord_get_guild_member`: Fetch a single member of a guild by user ID, returning their nickname, assigned roles, join date and avatar. Use it when you already know the user ID; to paginate all members use discord_list_guild_members, or to find members by name use discord_search_guild_members.
- `discord_list_guild_join_requests`: List membership screening join requests for a guild, optionally filtered by application status. Returns join requests with applicant user details and total count. Page older requests with before=next_before or newer with after=next_after. To approve or reject a request, use discord_review_guild_join_request.
- `discord_list_guild_members`: List members of a guild, ordered by user ID ascending. Requires the Server Members privileged Gateway intent (GUILD_MEMBERS). Page with after=next_after. To search members by username prefix instead, use discord_search_guild_members.
- `discord_preview_prune_guild`: Preview the number of inactive members that would be kicked in a prune operation before executing it. Always run this tool before discord_prune_guild to verify the impact. A member with a role outside include_roles is never pruned.
- `discord_prune_guild`: Prune inactive members from a guild. Always run discord_preview_prune_guild first to check how many members will be kicked. A member with a role outside include_roles is never pruned. Returns the number of pruned members when compute_prune_count is true. (asks for approval)
- `discord_review_guild_join_request`: Approve or reject a pending membership screening join request for a guild. Returns the updated join request record with its new status. To view pending requests first, use discord_list_guild_join_requests. (asks for approval)
- `discord_search_guild_members`: Search guild members whose username or nickname starts with the query string. Returns matching member objects, up to limit (default 1). To page through every member by ID use discord_list_guild_members.
- `discord_update_guild_member`: Update attributes of a guild member including nickname, roles, mute/deaf state, voice channel and timeout. The bot cannot edit the guild owner or members whose highest role is equal to or higher than the bot's highest role. Muting, deafening or moving a member fails with 400 unless they are in a voice channel; a timeout fails with 403 for the owner or an administrator. To change the bot's own nickname, banner, avatar or bio use discord_update_my_guild_member. (asks for approval)
- `discord_update_my_guild_member`: Update the bot's own nickname or server profile attributes in a specific guild. Returns the updated member object. To update attributes of other guild members instead, use discord_update_guild_member. To update the bot's global user profile, use discord_update_my_user.

</details>

<details>
<summary>roles (7 tools)</summary>

- `discord_bulk_update_guild_roles`: Modify the positions of a list of role objects for the guild (asks for approval)
- `discord_create_guild_role`: Create a new guild role (asks for approval)
- `discord_delete_guild_role`: Delete a guild role (asks for approval)
- `discord_get_guild_role`: Get a guild role
- `discord_get_guild_role_member_counts`: Get role member counts for a guild
- `discord_list_guild_roles`: List roles in a guild
- `discord_update_guild_role`: Update a guild role (asks for approval)

</details>

<details>
<summary>moderation (10 tools)</summary>

- `discord_ban_user_from_guild`: Ban a user from a guild and optionally purge their recent messages up to 7 days (604800 seconds). The bot cannot ban the guild owner or members whose highest role is equal to or higher than the bot's highest role. To ban multiple users at once, use discord_bulk_ban_users_from_guild. To kick without banning, use discord_delete_guild_member. (asks for approval)
- `discord_bulk_ban_users_from_guild`: Ban a list of up to 200 users from a guild simultaneously and optionally purge their messages up to 7 days (604800 seconds). The bot cannot ban the guild owner or members above its highest role. failed_users also lists users who were already banned; Discord returns error 500000 when nobody could be banned. Returns lists of successfully banned and failed user IDs. To ban a single user, use discord_ban_user_from_guild. (asks for approval)
- `discord_create_auto_moderation_rule`: Create an AutoMod rule in a guild. Rules per guild: 6 keyword rules, 1 each of the other trigger types. trigger_type cannot be changed after creation. Timeout (3) works only with 1=Keyword and 5=MentionSpam. Returns the created rule. To view existing AutoMod rules for a guild, use discord_list_auto_moderation_rules. (asks for approval)
- `discord_delete_auto_moderation_rule`: Permanently delete an AutoMod rule from a guild. To disable a rule without deleting it, use discord_update_auto_moderation_rule with enabled=false. To list remaining AutoMod rules, use discord_list_auto_moderation_rules. (asks for approval)
- `discord_get_auto_moderation_rule`: Fetch a single AutoMod rule by ID from a guild, including trigger configuration, actions and exempt filters. Use it when you already know the rule ID; to view all configured AutoMod rules in a guild, use discord_list_auto_moderation_rules.
- `discord_get_guild_ban`: Fetch ban details for a specific user in a guild, including the banned user object and optional ban reason. Use it when checking whether a known user is banned; to list all bans in the guild, use discord_list_guild_bans. To remove the ban, use discord_unban_user_from_guild.
- `discord_list_auto_moderation_rules`: List all AutoMod rules configured in a guild, including triggers, actions and exemptions. Returns an array of rule objects. To view a specific rule by ID, use discord_get_auto_moderation_rule. To create a new rule, use discord_create_auto_moderation_rule.
- `discord_list_guild_bans`: List banned users for a guild, ordered by user ID ascending. Returns ban objects with user details and reasons. Page with after=next_after. To look up a single user ban directly, use discord_get_guild_ban. To remove a ban, use discord_unban_user_from_guild.
- `discord_unban_user_from_guild`: Remove the ban for a user in a guild, allowing them to rejoin via invite. To check ban details before unbanning, use discord_get_guild_ban. To view all currently banned users, use discord_list_guild_bans. (asks for approval)
- `discord_update_auto_moderation_rule`: Modify an existing AutoMod rule in a guild. trigger_type cannot be changed after creation. Timeout (3) works only with 1=Keyword and 5=MentionSpam. Returns the updated rule. To delete the rule permanently instead, use discord_delete_auto_moderation_rule. (asks for approval)

</details>

<details>
<summary>events (11 tools)</summary>

- `discord_count_guild_scheduled_event_users`: Get total interested user counts for a guild scheduled event and its recurrence exceptions. Returns overall event count and an exception counts map keyed by exception ID. To list individual subscribed users instead, use discord_list_guild_scheduled_event_users.
- `discord_create_guild_scheduled_event`: Create a new scheduled event in a guild for a Stage channel (1=StageInstance), Voice channel (2=Voice) or external venue (3=External, requiring entity_metadata.location and scheduled_end_time). Privacy level is 2=GuildOnly. Returns the created scheduled event. To view events in the guild, use discord_list_guild_scheduled_events.
- `discord_create_guild_scheduled_event_exception`: Create an exception for a specific occurrence of a recurring guild scheduled event to cancel it or reschedule its time. Returns the created exception record. To update an existing exception later, use discord_update_guild_scheduled_event_exception; to remove it, use discord_delete_guild_scheduled_event_exception.
- `discord_delete_guild_scheduled_event`: Permanently delete a scheduled event from a guild. To cancel a scheduled event that has not started without deleting it, use discord_update_guild_scheduled_event with status=4 (Canceled); to end an active event use status=3 (Completed). To cancel a single occurrence of a recurring series, use discord_create_guild_scheduled_event_exception with is_canceled=true. (asks for approval)
- `discord_delete_guild_scheduled_event_exception`: Delete an exception for a recurring guild scheduled event, restoring that occurrence to the parent event's standard recurrence rule. To create an exception instead, use discord_create_guild_scheduled_event_exception. To modify it, use discord_update_guild_scheduled_event_exception. (asks for approval)
- `discord_get_guild_scheduled_event`: Fetch details for a single scheduled event in a guild by ID, with optional subscriber count. Use it when you already know the event ID; to list all scheduled events for the guild, use discord_list_guild_scheduled_events. To modify the event, use discord_update_guild_scheduled_event.
- `discord_list_guild_scheduled_event_exception_users`: List users subscribed to a specific recurrence exception of a guild scheduled event, ordered by user ID ascending. Returns users with next_after for paging. Page with after=next_after. To list subscribers of the parent scheduled event, use discord_list_guild_scheduled_event_users.
- `discord_list_guild_scheduled_event_users`: List users subscribed to a guild scheduled event, ordered by user ID ascending. Returns users with next_after for paging, optionally including guild member records. Page with after=next_after. To get aggregate subscriber counts instead, use discord_count_guild_scheduled_event_users.
- `discord_list_guild_scheduled_events`: List all scheduled events for a guild, with optional subscriber counts. Returns an array of scheduled event objects. To fetch full details for one specific event, use discord_get_guild_scheduled_event. To create a new event, use discord_create_guild_scheduled_event.
- `discord_update_guild_scheduled_event`: Modify an existing guild scheduled event. Status moves only from 1=Scheduled to 2=Active or 4=Canceled, and from 2=Active to 3=Completed. Returns the updated scheduled event. To permanently remove an event, use discord_delete_guild_scheduled_event. (asks for approval)
- `discord_update_guild_scheduled_event_exception`: Modify an existing exception for a recurring guild scheduled event to update its overridden start or end time, or cancel/uncancel the occurrence. Returns the updated exception. To delete the exception and restore original series timing, use discord_delete_guild_scheduled_event_exception. (asks for approval)

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
