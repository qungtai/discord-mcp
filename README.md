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

Early release (0.x): tool names and parameters can still change before 1.0. Available on npm as @qungtai/discord-mcp and on the MCP Registry as io.github.qungtai/discord-mcp.

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

To run these prompts, enable any toolset a prompt needs that is not already in the default with `DISCORD_MCP_TOOLSETS` (for example, `DISCORD_MCP_TOOLSETS="core,messages,reactions,threads,members,events,webhooks"`).

- "Summarize the last 50 messages in channel 123456789012345678." (messages toolset)
- "Post an announcement to channel 123456789012345678 with release notes and attach `/Users/name/Downloads/banner.png`." (messages toolset)
- "Create a private thread named 'incident-402' in channel 123456789012345678 and add user 987654321098765432."
- "List all guild members who currently have role 555666777888999000." (members toolset)
- "Schedule an upcoming community call event named 'Sprint Planning' starting tomorrow at 18:00 UTC in stage channel 123456789012345678." (events toolset)
- "Send a release notification using webhook 111222333444555666 with the custom username 'Deploy Bot'." (webhooks toolset)

## Toolsets

<!-- tools:start -->
| Toolset    | Default | Tools | What it covers                                                        | Bot permissions                                                                                                                                                                              |
| ---------- | ------- | ----: | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core       | Yes     |     6 | Current bot user, user lookup, guild list and leave, user connections | None                                                                                                                                                                                         |
| messages   | Yes     |    15 | Send, get, edit, delete, pin, search messages, polls, attachments     | AttachFiles, EmbedLinks, ManageMessages, MentionEveryone, PinMessages, ReadMessageHistory, SendMessages, SendMessagesInThreads, SendPolls, SendTTSMessages, UseExternalStickers, ViewChannel |
| reactions  | Yes     |     6 | Add, remove, list reactions on messages                               | AddReactions, ManageMessages, ReadMessageHistory, UseExternalEmojis, ViewChannel                                                                                                             |
| threads    | Yes     |    13 | Create, list, join, leave, archive threads and thread members         | CreatePrivateThreads, CreatePublicThreads, EmbedLinks, ManageThreads, ReadMessageHistory, SendMessages, SendMessagesInThreads, ViewChannel                                                   |
| channels   | No      |    13 | Create, edit, delete channels, permission overwrites, voice status    | Connect, ManageChannels, ManageRoles, ManageThreads, ManageWebhooks, SetVoiceChannelStatus, ViewChannel                                                                                      |
| webhooks   | No      |    10 | Create, edit, delete, execute webhooks and edit webhook messages      | ManageWebhooks                                                                                                                                                                               |
| guild      | No      |    22 | Guild settings, audit log, onboarding, welcome screen, widget         | ManageGuild, ManageRoles, ViewAuditLog                                                                                                                                                       |
| members    | No      |    12 | List, search, update, kick, mute, deafen members, prune               | ChangeNickname, Connect, DeafenMembers, KickMembers, ManageGuild, ManageNicknames, ManageRoles, ModerateMembers, MoveMembers, MuteMembers                                                    |
| roles      | No      |     7 | Create, update, delete, list guild roles, role member counts          | ManageRoles                                                                                                                                                                                  |
| moderation | No      |    10 | Ban, unban, list bans, AutoMod rules                                  | BanMembers, ManageGuild, ModerateMembers                                                                                                                                                     |
| events     | No      |    11 | Create, update, delete scheduled events and list subscribers          | CreateEvents, ManageEvents                                                                                                                                                                   |
| invites    | No      |    12 | Create, get, delete invites, guild/channel invites, target users      | CreateInstantInvite, ManageChannels, ManageGuild, ManageRoles                                                                                                                                |

Default is `core,messages,reactions,threads`. Enable more toolsets with `DISCORD_MCP_TOOLSETS` (comma-separated).

Permissions integer for the default toolsets: `2815282343574592`.
Permissions integer for all implemented toolsets: `3115458644933879`.

<details>
<summary>core (6 tools)</summary>

- `discord_get_my_user`: Fetch the bot's own user object: id, username, global name, avatar, banner and flags. Use it to confirm which account the token belongs to; to look up any other user by ID use discord_get_user. Returns the user object.
- `discord_get_user`: Fetch any Discord user by user ID: username, global name, avatar, banner, accent color and whether the account is a bot. Use it to resolve an ID taken from a message author, a mention or a poll voter; for the bot's own account use discord_get_my_user, and for guild data such as nickname, roles and join date use discord_get_guild_member (members toolset). Returns the user object.
- `discord_leave_guild`: Remove the authenticated bot from a guild by server ID. The bot ceases to be a member immediately and requires a new invite URL with bot scopes to rejoin. Use this when the bot is instructed to depart a server; to kick another member use discord_delete_guild_member (members toolset). Returns deleted: true and the guild ID. (asks for approval)
- `discord_list_my_connections`: List the external accounts (for example GitHub, Twitch, YouTube, Steam) linked to the account behind the credential, with each connection's name, type, verified flag and visibility. Discord requires an OAuth2 token with the connections scope for this endpoint, so a plain bot token can be refused; to list the guilds the bot is in use discord_list_my_guilds. Returns the connections array.
- `discord_list_my_guilds`: List the Discord guilds (servers) the authenticated bot account belongs to. Use this to discover available guild IDs before calling guild-scoped tools, or to check membership counts. Page older results with before and newer results with after. Under DISCORD_MCP_ALLOWED_GUILDS, paging parameters must be omitted; every allowed guild is returned in a single call. Returns partial guild objects plus next_before and next_after cursors; both are set only when the page is full, so a full page can be followed by an empty one, and both are null when the page holds fewer guilds than limit.
- `discord_update_my_user`: Update the authenticated bot's global username, avatar image, or banner image. Changes apply globally across every server the bot is in. Changing the username can randomize the discriminator. To change the bot's nickname or avatar in one guild only, use discord_update_my_guild_member (members toolset). Returns the updated bot user object. (asks for approval)

</details>

<details>
<summary>messages (15 tools)</summary>

- `discord_bulk_delete_messages`: Delete 2 to 100 messages from a guild channel in one request. The whole request fails if any message is older than 14 days or any message ID is duplicated. To delete a single message instead use discord_delete_message. (asks for approval)
- `discord_create_pin`: Pin a message in a channel or thread so it appears in the channel's pinned list. Use it to keep an important message easy to find; use discord_list_pins to see what is pinned and discord_delete_pin to unpin. Returns pinned: true with the channel and message IDs.
- `discord_crosspost_message`: Publish a message posted in an announcement channel (type 5) so Discord copies it into every channel that follows that channel. Use it after posting with discord_send_message in an announcement channel; regular text channels cannot be crossposted, and a message can be published only once, so a second call fails. Manage Messages is only needed for messages the bot did not send. Returns the published message.
- `discord_delete_message`: Permanently delete a single message from a channel or thread. To delete between 2 and 100 recent messages at once use discord_bulk_delete_messages. Returns a confirmation object with the deleted message and channel IDs. (asks for approval)
- `discord_delete_pin`: Unpin a pinned message from a channel or thread. To add a pin use discord_create_pin, and to list all current pinned messages use discord_list_pins. Returns a confirmation object with the unpinned message and channel IDs.
- `discord_download_attachment`: Download a message attachment from Discord into the local download folder (DISCORD_MCP_DOWNLOAD_DIR, default ~/Downloads/discord-mcp). Requires the message ID and the specific attachment ID (attachment_id comes from the attachments of discord_get_message). Returns local file path, size, content type and SHA-256 hash.
- `discord_edit_message`: Edit a message the bot sent: replace its content or embeds, add uploaded files, and change the description or spoiler flag of existing attachments. Existing attachments are always kept; they cannot be removed with this tool. Discord only lets a bot edit its own messages; to post a new message use discord_send_message. Returns the updated message.
- `discord_end_poll`: End a poll the bot created before its duration runs out. Discord does not let a bot end polls posted by other users. Returns the message with the poll; Discord finishes the final vote count in the background, so read the final tally later with discord_get_message once poll.results.is_finalized is true.
- `discord_get_message`: Fetch one message by ID from a channel or thread, with its author, content, attachments, embeds, reactions and poll. Use it when you already have the message ID; to read recent history use discord_list_messages, and to find messages by text use discord_search_guild_messages.
- `discord_list_messages`: List messages from a channel or thread, newest first. Provide before, after, or around snowflake IDs to paginate or center the search window. To fetch a specific message by ID use discord_get_message, and to search messages by text or author across an entire server use discord_search_guild_messages. Page older messages with before=next_before.
- `discord_list_pins`: List the pinned messages of a channel or thread, newest pin first, each with its pin time. To pin a message use discord_create_pin, and to unpin use discord_delete_pin. Page with before=next_before while has_more is true.
- `discord_list_poll_answer_voters`: Get a paginated list of users that voted for a specific answer on a poll message. Use it after fetching a poll message with discord_get_message to see who selected each answer. Page subsequent voters with after=next_after.
- `discord_search_guild_messages`: Search messages across a whole guild by text and filters (author, channel, mentions, attachments, links, embeds, pinned state, message ID range). Use discord_list_messages to read one channel in order. Results come back newest first by default; a page can hold fewer than limit, so page with offset=next_offset until it is null. A new or busy guild index can answer "not ready"; the tool then fails with a retryable error that carries the retry delay in seconds. Results omit reactions.
- `discord_send_message`: Send a message to a channel or thread. It can carry text, embeds, a poll, files from the local machine, a reply to an existing message, stickers (up to 3) and flags (suppress embeds, silent). At least one of content, embeds, sticker_ids, files or poll is required. Mentions do not ping unless allowed_mentions permits it. To change a message already sent use discord_edit_message. A retry without the same nonce posts a second message.
- `discord_trigger_typing_indicator`: Show the typing indicator in a channel or thread for 10 seconds, for a bot that needs a few seconds to prepare an answer. Discord advises most bots not to use it. To post the reply use discord_send_message.

</details>

<details>
<summary>reactions (6 tools)</summary>

- `discord_add_my_message_reaction`: Add a reaction to a message as the bot user. Specify unicode characters or custom emojis as name:id. Adding the same reaction twice is not an error. To see who already reacted, use discord_list_message_reactions_by_emoji; to remove this reaction later, use discord_delete_my_message_reaction.
- `discord_delete_all_message_reactions`: Delete all reactions across all emojis and users on a single message. This permanently clears the reaction list for everyone. To remove only a single emoji type across users, use discord_delete_all_message_reactions_by_emoji; to remove only the bot's own reaction, use discord_delete_my_message_reaction. (asks for approval)
- `discord_delete_all_message_reactions_by_emoji`: Delete all reactions for one specified emoji on a message across every user who reacted. To remove every emoji reaction at once, use discord_delete_all_message_reactions; to remove only the bot's own reaction, use discord_delete_my_message_reaction. (asks for approval)
- `discord_delete_my_message_reaction`: Delete the bot's own reaction for a specific emoji on a message. This only removes the bot's reaction and does not affect other users. To delete another user's reaction, use discord_delete_user_message_reaction; to add a reaction, use discord_add_my_message_reaction.
- `discord_delete_user_message_reaction`: Delete another user's reaction for a specific emoji on a message. This removes only the target user's reaction, leaving all other reactions untouched. To remove the bot's own reaction without moderation permissions, use discord_delete_my_message_reaction; to remove all reactions of this emoji, use discord_delete_all_message_reactions_by_emoji. (asks for approval)
- `discord_list_message_reactions_by_emoji`: List the users who reacted to a message with one emoji, ordered by user ID. Returns users and next_after; pass it as after to get the next page, and stop when a page comes back empty. To add the bot's own reaction, use discord_add_my_message_reaction.

</details>

<details>
<summary>threads (13 tools)</summary>

- `discord_add_thread_member`: Add another user to a thread by user ID. The thread must not be archived, and the call succeeds without change if the user is already a member. To have the bot join a thread instead, use discord_join_thread; to remove a member, use discord_delete_thread_member.
- `discord_create_thread`: Create a new thread without a starter message, or start a new post in a forum or media channel. Type 10 is an announcement thread (announcement channels only), 11 is a public thread visible to anyone who can view the parent channel, and 12 is a private thread visible only to invited members and moderators; type defaults to 12 when omitted. In forum or media channels pass message to create the first post. Returns the created thread.
- `discord_create_thread_from_message`: Create a new public or announcement thread from an existing message in a text or announcement channel. The new thread gets the same ID as the source message, so a message can have only one thread. Not supported in forum or media channels. Returns the created thread. To create a standalone thread without a starter message, use discord_create_thread.
- `discord_delete_thread_member`: Remove another user from a thread by user ID. Needs Manage Threads, or being the creator of a private thread; the thread must not be archived. To have the bot leave a thread instead, use discord_leave_thread; to add someone to a thread, use discord_add_thread_member. (asks for approval)
- `discord_get_thread_member`: Fetch membership details for one user in a thread, including their join timestamp and flags. Fails with 404 if the user is not a member. Set with_member to true to include full guild member details. To list all members of a thread, use discord_list_thread_members.
- `discord_join_thread`: Add the bot user to a thread. The thread must not be archived. To remove the bot from a thread, use discord_leave_thread; to add another user, use discord_add_thread_member.
- `discord_leave_thread`: Remove the bot user from a thread. If the thread is private, the bot must be re-added or reinvited to rejoin. To join a thread, use discord_join_thread; to remove another user, use discord_delete_thread_member.
- `discord_list_active_guild_threads`: List every active (unarchived) thread in a guild, public and private, newest ID first. Returns threads and the bot's thread member entry for each one it has joined. To find archived threads use discord_list_public_archived_threads or discord_list_private_archived_threads.
- `discord_list_my_private_archived_threads`: List private archived threads within a channel that the bot user has joined. Returns thread objects, thread member entries, and a next_before cursor. Page older threads in descending order using before=next_before. To list all private archived threads in the channel regardless of bot participation, use discord_list_private_archived_threads.
- `discord_list_private_archived_threads`: List private archived threads in a channel. Returns thread objects, thread member entries, and a next_before cursor. Page older threads in descending order by archive timestamp using before=next_before. To list public archived threads instead, use discord_list_public_archived_threads.
- `discord_list_public_archived_threads`: List public archived threads in a channel. Returns thread objects, thread member entries, and a next_before cursor. Page older threads in descending order by archive timestamp using before=next_before. To list private archived threads instead, use discord_list_private_archived_threads.
- `discord_list_thread_members`: List members of a thread. Note that after and limit only apply when with_member is true, and Discord restricts this endpoint by the Server Members privileged intent. Returns thread members and next_after; page forward using after=next_after and stop when a page comes back empty. To fetch a single member, use discord_get_thread_member.
- `discord_search_threads`: Search threads in a channel by name, tags, and time bounds. New threads take about 30 seconds to appear in search results. Returns matched threads, first messages, and member objects. Page results with offset=next_offset. To browse active threads without indexing delays, use discord_list_active_guild_threads.

</details>

<details>
<summary>channels (13 tools)</summary>

- `discord_bulk_update_guild_channels`: Modify the sorting positions and parent categories for a set of channels in a guild. Can sync channel permissions with parent categories via lock_permissions. Use discord_update_channel to change single-channel properties such as topic, name or bitrate. Returns the updated guild ID and list of affected channel IDs. (asks for approval)
- `discord_create_dm`: Open a direct message (DM) channel with a target user. When a guild allowlist is active, DMs are blocked unless DISCORD_MCP_ALLOW_DMS is set to true. Use discord_send_message to post messages to the resulting DM channel. Returns the DM channel object.
- `discord_create_guild_channel`: Create a new channel in a guild, such as a text (0), voice (2), category (4), announcement (5), stage (13), or forum (15) channel. Permission overwrites combine allow and deny bitfields, with member-specific overwrites taking precedence over role overwrites. Use discord_update_channel to modify settings after creation. Returns the newly created channel. (asks for approval)
- `discord_delete_channel`: Delete a guild channel or thread, or close a direct message (DM) channel. Deleting a guild channel cannot be undone. To archive a thread without deleting it, use discord_update_channel with archived: true. Returns the deleted status and channel ID. (asks for approval)
- `discord_delete_channel_permission_overwrite`: Delete the permission overwrite for one role or member on a channel. Their access then comes from the remaining overwrites and their guild roles; it is not copied back from the parent category. To create or change an overwrite use discord_set_channel_permission_overwrite. Returns the deleted status with the channel and overwrite IDs. (asks for approval)
- `discord_follow_channel`: Follow an announcement (type 5) channel to automatically crosspost messages into a target channel in another guild or the same guild. Creates a follower webhook in the target channel. Use discord_crosspost_message to publish a message from an announcement channel. Returns the source channel ID and created follower webhook ID.
- `discord_get_channel`: Fetch details for a guild channel, category, thread or direct message channel by its snowflake ID. Use discord_list_guild_channels to list all channels in a guild, or discord_list_thread_members to inspect thread participants. Returns a Channel object containing metadata such as type, topic, permission overwrites and position.
- `discord_get_member_permissions`: Compute permissions for a guild member either across the guild or within a specific channel. Provide exactly one of guild_id (permissions from roles only) or channel_id (permissions after overwrites). Use discord_get_role_permissions to evaluate role permissions instead. Returns the computed permissions as a decimal bitfield string.
- `discord_get_role_permissions`: Compute permissions for a guild role either across the guild or within a specific channel. Provide exactly one of guild_id (permissions from roles only) or channel_id (permissions after overwrites). Use discord_get_member_permissions to evaluate a specific member's permissions. Returns the computed permissions as a decimal bitfield string.
- `discord_list_guild_channels`: List all channels, categories, voice channels and forum channels in a guild. Does not include active or archived threads; use discord_list_active_guild_threads, discord_list_public_archived_threads or discord_list_private_archived_threads for threads. Returns an array of Channel objects ordered by category and position.
- `discord_set_channel_permission_overwrite`: Set or edit a permission overwrite for a role or member in a channel. Overwrites combine allow and deny bitfields, with member overwrites taking precedence over role overwrites. Use discord_delete_channel_permission_overwrite to remove an overwrite completely. Returns the updated status with channel and overwrite IDs. (asks for approval)
- `discord_update_channel`: Change settings on a guild channel, category or thread; only the fields you send are modified. Channel fields (name, topic, bitrate, permission_overwrites, forum settings) apply to guild channels, and archived, locked, invitable and auto_archive_duration apply to threads. Include every overwrite or tag you want to keep. Overwrites combine allow and deny bitfields, and member overwrites win over role overwrites. To reorder several channels use discord_bulk_update_guild_channels. Returns the updated channel. (asks for approval)
- `discord_update_voice_channel_status`: Set or clear the status line shown under a voice channel. Pass up to 500 characters of text, or null to clear it. Needs the SetVoiceChannelStatus permission, plus ManageChannels when the bot is not connected to the channel. Stage channels are not supported; use discord_update_channel. To read the channel type first use discord_get_channel. Returns the updated status and channel ID. (asks for approval)

</details>

<details>
<summary>webhooks (10 tools)</summary>

- `discord_create_webhook`: Create a new incoming webhook in a guild channel. The returned webhook contains an ID used by other webhook tools; webhook tools in this MCP server take webhook_id and never a token or webhook URL. Use discord_execute_webhook to send messages through the created webhook. Returns the sanitized webhook object.
- `discord_delete_webhook`: Permanently delete a webhook by its snowflake ID. Webhook tools take webhook_id and never a token or webhook URL. Deletion cannot be undone; use discord_create_webhook to create a replacement webhook. Returns the deleted status and webhook ID. (asks for approval)
- `discord_delete_webhook_message`: Permanently delete one message that was sent through a webhook. Webhook tools take webhook_id and never a token or webhook URL. To check the message first use discord_get_webhook_message; to delete an ordinary channel message use discord_delete_message. Pass thread_id when the message is in a thread. Returns the deleted status with the webhook and message IDs. (asks for approval)
- `discord_edit_webhook_message`: Edit a message previously sent by a webhook, modifying content, embeds, attachments, or allowed mentions. Webhook tools take webhook_id and never a token or webhook URL, resolving the token automatically. Use discord_get_webhook_message to read the current message. Returns the updated message object. (asks for approval)
- `discord_execute_webhook`: Post a message through an incoming webhook, with optional embeds, files, a poll and a custom username or avatar. Webhook tools take webhook_id and never a token or webhook URL. Send at least one of content, embeds, files or poll. Use thread_id to post into an existing thread, or thread_name to open a new post in a forum or media channel. To change a sent message use discord_edit_webhook_message. Returns the created message. (asks for approval)
- `discord_get_webhook`: Fetch a webhook by its snowflake ID. Webhook tools take webhook_id and never a token or webhook URL, automatically resolving the required token internally. Use discord_list_channel_webhooks to find webhooks in a specific channel. Returns the sanitized webhook object with credentials redacted.
- `discord_get_webhook_message`: Fetch a message previously posted by a webhook. Webhook tools take webhook_id and never a token or webhook URL, resolving the token automatically. Use discord_edit_webhook_message to update the message or discord_delete_webhook_message to remove it. Returns the message object.
- `discord_list_channel_webhooks`: List all webhooks configured for a specific channel. Webhook tools take webhook_id and never a token or webhook URL. Use discord_list_guild_webhooks to inspect all webhooks across an entire guild instead. Returns an array of sanitized webhook objects with tokens redacted.
- `discord_list_guild_webhooks`: List all webhooks configured across all channels in a guild. Webhook tools take webhook_id and never a token or webhook URL. Use discord_list_channel_webhooks to narrow results to a specific channel. Returns an array of sanitized webhook objects with tokens redacted.
- `discord_update_webhook`: Update a webhook's name, avatar, or move it to another channel. Webhook tools take webhook_id and never a token or webhook URL. Use discord_delete_webhook to remove a webhook permanently. Returns the updated sanitized webhook object. (asks for approval)

</details>

<details>
<summary>guild (22 tools)</summary>

- `discord_create_guild_template`: Create a new template from an existing guild snapshot. Discord permits only one template per guild; creating another fails unless the existing one is deleted. To list existing templates use discord_list_guild_templates. Returns the created template object including its unique code.
- `discord_delete_guild_integration`: Delete an integration from a guild. Discord also deletes the webhooks tied to it and kicks the associated bot, if there is one. This cannot be undone. Find integration IDs with discord_list_guild_integrations. Returns the guild and integration IDs. (asks for approval)
- `discord_delete_guild_template`: Delete a template from a guild by template code. Because Discord allows only one template per guild, deleting the existing template permits creating a new snapshot. To inspect the template before deleting use discord_get_guild_template. Returns the deleted template object. (asks for approval)
- `discord_get_guild`: Fetch detailed information for a guild by ID that the bot currently belongs to. To view basic discoverable information without bot membership use discord_get_guild_preview, and to list all guilds the bot belongs to use discord_list_my_guilds. Returns the full guild object including owner ID, features, verification level, and optional counts.
- `discord_get_guild_new_member_welcome`: Retrieve the new member welcome experience (Home tab settings) for a guild. This feature requires Community to be enabled on the guild. To inspect full onboarding questions use discord_get_guild_onboarding, or use discord_get_guild_welcome_screen for legacy welcome screens. Returns welcome settings or null when unconfigured.
- `discord_get_guild_onboarding`: Retrieve the onboarding setup of a guild: prompts with their options, default channels, whether onboarding is enabled, and the mode. Onboarding is a Community server feature. To change it use discord_update_guild_onboarding. Returns the onboarding object.
- `discord_get_guild_preview`: Fetch the public preview of a guild: name, icon, splash, emoji, stickers, features and approximate member and presence counts. If the bot is not a member, the guild must have the DISCOVERABLE feature. For full details of a guild the bot is in use discord_get_guild. Returns the guild preview object.
- `discord_get_guild_template`: Fetch a guild template by its unique template code without requiring guild membership. Each guild can have at most one template. To list templates belonging to a specific guild use discord_list_guild_templates. Returns the template details including serialized guild structure and usage count.
- `discord_get_guild_vanity_url`: Retrieve the custom vanity URL invite code and usage statistics for a guild. Vanity URLs need the VANITY_URL feature, usually unlocked by Server Boost Level 3. To inspect regular guild invites use discord_list_guild_invites. Returns the vanity code (null when none is set) and its use count.
- `discord_get_guild_welcome_screen`: Retrieve the welcome screen of a guild: its description and up to 5 featured channels. The welcome screen is a Community server feature. To change it use discord_update_guild_welcome_screen. Returns the welcome screen object.
- `discord_get_guild_widget`: Fetch public widget JSON data for a guild, including active voice channels and online members. Requires the guild widget to be enabled in widget settings. To view or toggle widget configuration use discord_get_guild_widget_settings or discord_update_guild_widget_settings. Returns public widget info including channel list and online presence count.
- `discord_get_guild_widget_settings`: Retrieve widget settings for a guild, indicating whether the embeddable widget is enabled and which channel it binds to. To read the rendered widget payload with member presences use discord_get_guild_widget. To toggle the widget or change its invite channel use discord_update_guild_widget_settings. Returns whether the widget is enabled and its channel ID.
- `discord_list_guild_audit_log_entries`: List audit log entries for a guild. Without a cursor, or with before, entries come newest first; with after they come oldest first. Filter by user_id (who acted), target_id (what was changed) or action_type, and return 1 to 100 entries per call (default 50). To page to older entries pass before=next_before from a newest-first page. next_before is the lowest ID on a newest-first page and the highest ID on an after page, so after an after page continue with after=next_before. Returns audit_log_entries plus the related users, integrations, webhooks, threads and scheduled events.
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

- `discord_ban_user_from_guild`: Ban a user from a guild and optionally purge their recent messages up to 7 days (604800 seconds). The bot cannot ban the guild owner or members whose highest role is equal to or higher than the bot's highest role. To ban multiple users at once, use discord_bulk_ban_users_from_guild. To kick without banning, use discord_delete_guild_member. (asks for approval)
- `discord_bulk_ban_users_from_guild`: Ban a list of up to 200 users from a guild simultaneously and optionally purge their messages up to 7 days (604800 seconds). The bot cannot ban the guild owner or members whose highest role is at or above the bot's. failed_users also lists users who were already banned; Discord returns error 500000 when nobody could be banned. Returns lists of successfully banned and failed user IDs. To ban a single user, use discord_ban_user_from_guild. (asks for approval)
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

- `discord_add_invite_target_user`: Add a single target user to an existing invite code so only authorized users can accept it. Target users can also be uploaded in bulk via CSV using discord_set_invite_target_users or discord_bulk_add_invite_target_users. Use discord_delete_invite_target_user to remove a user. Returns the added status, invite code, and user ID. (asks for approval)
- `discord_bulk_add_invite_target_users`: Add multiple target users to an existing invite code in a single API call (up to 1000 user IDs). Target users can also be uploaded from a CSV file using discord_set_invite_target_users. Use discord_bulk_delete_invite_target_users to remove multiple users at once. Returns the added status, invite code, and count of users added. (asks for approval)
- `discord_bulk_delete_invite_target_users`: Remove multiple target users from an existing invite code in a single API call (up to 1000 user IDs). Use discord_delete_invite_target_user to remove a single user, or discord_bulk_add_invite_target_users to add users. Returns the deleted status, invite code, and count of users removed. (asks for approval)
- `discord_create_channel_invite`: Create a new invite code for a guild channel. Supports setting expiration, usage limits, temporary membership, target applications or stream users, and role granting. Use discord_get_invite to inspect an existing invite or discord_list_channel_invites to view all invites for a channel. Returns the created invite object. (asks for approval)
- `discord_delete_invite`: Permanently delete and revoke an invite code from a guild channel. Deletion cannot be undone; use discord_create_channel_invite to generate a replacement invite. Returns the deleted invite object containing its final metadata. (asks for approval)
- `discord_delete_invite_target_user`: Remove a single target user from an existing invite code. To remove multiple target users at once, use discord_bulk_delete_invite_target_users. Use discord_add_invite_target_user to grant an authorized user access to this invite. Returns the deleted status, invite code, and removed user ID. (asks for approval)
- `discord_get_invite`: Fetch invite metadata by invite code, optionally including member and online presence counts. Use discord_delete_invite to revoke an invite. Returns the invite object with channel, guild, and expiration details.
- `discord_get_invite_target_users_job_status`: Check the status of an asynchronous target user CSV processing job for an invite. status is 1 while processing, then 2 when completed or 3 when failed (see error_message); 0 is the unset default. Use discord_set_invite_target_users to initiate a CSV upload. Returns the job status object with total_users, processed_users, and error_message.
- `discord_list_channel_invites`: List all active invite codes for a specific guild channel, including usage statistics and expiration timestamps. Use discord_list_guild_invites to view all active invites across the entire guild. Returns an array of invite objects with inviter and use counts.
- `discord_list_guild_invites`: List all active invite codes across all channels in a guild, including inviter details and usage counts. Use discord_list_channel_invites to restrict results to a single channel. Returns an array of invite objects.
- `discord_list_invite_target_users`: Fetch the users allowed to accept an invite, as CSV text. The first line is the header user_id, followed by one user ID per line. To replace the list use discord_set_invite_target_users; to add one user use discord_add_invite_target_user. Returns the CSV in the csv field.
- `discord_set_invite_target_users`: Replace the authorized target users for an invite by uploading a CSV file. The CSV has a single column of user IDs, one per line; duplicates are ignored and invalid IDs fail with a 400 that lists them. Triggering this upload starts an asynchronous processing job; poll progress with discord_get_invite_target_users_job_status. Returns the updated status and invite code. (asks for approval)

</details>
<!-- tools:end -->

## Configuration

The default toolsets expose 40 tools. Clients with a tool limit can narrow it, for example `DISCORD_MCP_TOOLSETS=core,messages`.

| Variable                         | Default                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`                  | _required_                        | Discord bot authentication token.                                                                                                                                                                                                                                                                                                                                                                                                |
| `DISCORD_MCP_ALLOWED_GUILDS`     | _(empty)_                         | Comma-separated list of allowed guild IDs. When set, operations outside these guilds are refused.                                                                                                                                                                                                                                                                                                                                |
| `DISCORD_MCP_ALLOW_DMS`          | `false`                           | Permits direct messages and user-scoped operations alongside an active guild allowlist (`true` or `false`). Any other value stops startup.                                                                                                                                                                                                                                                                                       |
| `DISCORD_MCP_TOOLSETS`           | `core,messages,reactions,threads` | Comma-separated list of enabled toolsets. <!-- config-toolsets:start --> Available: core, messages, reactions, threads, channels, webhooks, guild, members, roles, moderation, events, invites. <!-- config-toolsets:end -->                                                                                                                                                                                                     |
| `DISCORD_MCP_READ_ONLY`          | `false`                           | Blocks all mutating actions and allows read-only tools only (`true` or `false`). Any other value stops startup.                                                                                                                                                                                                                                                                                                                  |
| `DISCORD_MCP_APPROVAL`           | `elicitation`                     | Confirmation mode for destructive operations (`elicitation` or `none`). Any other value stops startup.                                                                                                                                                                                                                                                                                                                           |
| `DISCORD_MCP_FILE_ROOTS`         | _(empty)_                         | Optional comma-separated list of directory paths accessible for uploads; a leading `~/` is expanded with the user home directory. When unset, empty, or parsing to no entries, file access is open by default for any absolute path, except hidden files and directories, system paths (`/proc`, `/sys`, `/dev`), and application configuration directories (`~/Library` on macOS, `%APPDATA%` and `%LOCALAPPDATA%` on Windows). |
| `DISCORD_MCP_DOWNLOAD_DIR`       | `~/Downloads/discord-mcp`         | Directory path where attachment downloads are stored; a leading `~/` is expanded with the user home directory. Defaults to `~/Downloads/discord-mcp` and is created recursively on first download.                                                                                                                                                                                                                               |
| `DISCORD_MCP_REQUEST_TIMEOUT_MS` | `15000`                           | HTTP request timeout in milliseconds for Discord REST API requests.                                                                                                                                                                                                                                                                                                                                                              |
| `DISCORD_MCP_RATE_LIMIT_WAIT_MS` | `5000`                            | Maximum wait duration in milliseconds when encountering a Discord rate limit before aborting.                                                                                                                                                                                                                                                                                                                                    |
| `DISCORD_MCP_MAX_UPLOAD_BYTES`   | `20971520`                        | Maximum upload size in bytes (defaults to 20 MiB).                                                                                                                                                                                                                                                                                                                                                                               |
| `DISCORD_MCP_MAX_DOWNLOAD_BYTES` | `104857600`                       | Maximum download size in bytes for `discord_download_attachment` (defaults to 100 MiB).                                                                                                                                                                                                                                                                                                                                          |

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

### Releasing

Releases are published automatically via the GitHub Actions `Release` workflow upon pushing a version tag (`v*.*.*`):
1. Verifies the tag is on `main`, checks versions, and runs full test and coverage suites.
2. Publishes the npm package to `@qungtai/discord-mcp` with provenance via npm trusted publishing.
3. Builds and pushes the multi-arch container image to `ghcr.io/qungtai/discord-mcp`.
4. Submits server metadata to the MCP Registry (`io.github.qungtai/discord-mcp`) using `mcp-publisher` authenticated via GitHub Actions OIDC (`github-oidc`).

To publish a version that is on npm but missing from the registry (for example after a failed registry job) without re-triggering npm or Docker releases, trigger the `Release` workflow manually (`workflow_dispatch`) on `main`. The workflow verifies matching package versions and confirms the release is already available on npm before publishing to the registry.

For contribution guidelines and security disclosure policies, see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

Not affiliated with or endorsed by Discord Inc.
