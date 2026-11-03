# Client configuration (stdio)

All examples run the server over stdio. The primary installation method is `npx -y @qungtai/discord-mcp`. For local development from a repository checkout, use the from-source command pointing to `dist/index.js`.

Pass the bot token through the environment. Never put it in a tool argument.

## Claude Code

Primary (`npx`):

```sh
claude mcp add discord -e DISCORD_TOKEN="your-bot-token" -e DISCORD_MCP_ALLOWED_GUILDS="123456789012345678" -- npx -y @qungtai/discord-mcp
```

From source:

```sh
claude mcp add discord -e DISCORD_TOKEN="your-bot-token" -e DISCORD_MCP_ALLOWED_GUILDS="123456789012345678" -- node /absolute/path/dist/index.js
```

Or configure manually in `~/.claude.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
      }
    }
  }
}
```

From-source alternative:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
      }
    }
  }
}
```

## Claude Desktop

Config file path:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Primary (`npx`):

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
      }
    }
  }
}
```

From-source alternative:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
      }
    }
  }
}
```

## Codex

Add with the CLI:

```sh
codex mcp add discord -e DISCORD_TOKEN="your-bot-token" -e DISCORD_MCP_ALLOWED_GUILDS="123456789012345678" -- npx -y @qungtai/discord-mcp
```

Or configure in `~/.codex/config.toml`:

```toml
[mcp_servers.discord]
command = "npx"
args = ["-y", "@qungtai/discord-mcp"]

[mcp_servers.discord.env]
DISCORD_TOKEN = "your-bot-token"
DISCORD_MCP_ALLOWED_GUILDS = "123456789012345678"
```

From-source alternative:

```toml
[mcp_servers.discord]
command = "node"
args = ["/absolute/path/dist/index.js"]

[mcp_servers.discord.env]
DISCORD_TOKEN = "your-bot-token"
DISCORD_MCP_ALLOWED_GUILDS = "123456789012345678"
```

## Cursor

Configure in `.cursor/mcp.json` or Cursor Settings > MCP:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
      }
    }
  }
}
```

From-source alternative:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
      }
    }
  }
}
```

## VS Code

Configure in `.vscode/mcp.json`:

```json
{
  "servers": {
    "discord": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@qungtai/discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "${input:discordToken}",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
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

From-source alternative:

```json
{
  "servers": {
    "discord": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "${input:discordToken}",
        "DISCORD_MCP_ALLOWED_GUILDS": "123456789012345678"
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

## MCP Inspector

Primary (`npx`):

```sh
npx @modelcontextprotocol/inspector npx -y @qungtai/discord-mcp
```

From source:

```sh
npx @modelcontextprotocol/inspector node /absolute/path/dist/index.js
```

Set `DISCORD_TOKEN` and `DISCORD_MCP_ALLOWED_GUILDS` in the inspector environment panel before connecting.

## Approval support in each client

Destructive tools ask for confirmation with MCP elicitation (`elicitation/create`). The client must advertise the `elicitation` capability, otherwise the tool is refused with a `policy` error.

- Claude Code 2.1.309 was verified on 3 November 2026 to show the approval dialog and accept it end to end.
- Codex 0.166.0 was verified on 3 November 2026: with approval mode on-request (`codex -a on-request`) it first asks to allow the MCP tool call and then shows the server approval prompt, and accepting runs the tool end to end; in full-access mode Codex declines the elicitation without asking, so destructive tools return "Approval declined". Use on-request for destructive tools, or set `DISCORD_MCP_APPROVAL=none` if you rely on Codex's own approvals.
- Other clients: check your client. If it does not support elicitation, set `DISCORD_MCP_APPROVAL=none` and rely on the client tool confirmation.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | *required* | Discord bot authentication token |
| `DISCORD_MCP_ALLOWED_GUILDS` | *(empty)* | Comma-separated list of allowed guild (server) IDs. When set, only operations on these guilds are permitted. Non-guild resources that are not DMs are refused. |
| `DISCORD_MCP_ALLOW_DMS` | `false` | Set to `true` to allow direct messages and user-scoped operations when a guild allowlist is configured. |
| `DISCORD_MCP_TOOLSETS` | `core,messages` | Comma-separated list of enabled toolsets. Available: core, messages, reactions, threads, channels, webhooks, guild, members, roles, moderation, events, invites. |
| `DISCORD_MCP_READ_ONLY` | `false` | Set to `true` to block all mutating operations and allow read-only tools only. |
| `DISCORD_MCP_APPROVAL` | `elicitation` | Approval mechanism for destructive actions. `elicitation` prompts via MCP elicitation; `none` bypasses server-side prompting. |
| `DISCORD_MCP_FILE_ROOTS` | *(empty)* | Comma-separated absolute filesystem directory paths permitted for file attachments and uploads. |
| `DISCORD_MCP_DOWNLOAD_DIR` | *(empty)* | Absolute directory path where downloaded attachments are saved. |
| `DISCORD_MCP_REQUEST_TIMEOUT_MS` | `15000` | HTTP request timeout in milliseconds for Discord API calls. |
| `DISCORD_MCP_RATE_LIMIT_WAIT_MS` | `5000` | Maximum wait time in milliseconds for Discord rate limits before aborting. |
| `DISCORD_MCP_MAX_UPLOAD_BYTES` | `20971520` | Maximum upload size in bytes (defaults to 20 MiB). |
