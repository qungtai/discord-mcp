# Client configuration (stdio)

All examples run the server over stdio. The primary installation method is `npx -y @qungtai/discord-mcp`. For local development from a repository checkout, use the from-source command pointing to `dist/index.js`.

Pass the bot token through the environment. Never put it in a tool argument.

## Claude Code

Primary (`npx`):

```sh
claude mcp add discord -e DISCORD_TOKEN="your-bot-token" -- npx -y @qungtai/discord-mcp
```

From source:

```sh
claude mcp add discord -e DISCORD_TOKEN="your-bot-token" -- node /absolute/path/dist/index.js
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

From-source alternative:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
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
        "DISCORD_TOKEN": "your-bot-token"
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
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

## Codex

Add with the CLI:

```sh
codex mcp add discord --env DISCORD_TOKEN="your-bot-token" -- npx -y @qungtai/discord-mcp
```

Or configure in `~/.codex/config.toml`:

```toml
[mcp_servers.discord]
command = "npx"
args = ["-y", "@qungtai/discord-mcp"]

[mcp_servers.discord.env]
DISCORD_TOKEN = "your-bot-token"
```

From-source alternative:

```toml
[mcp_servers.discord]
command = "node"
args = ["/absolute/path/dist/index.js"]

[mcp_servers.discord.env]
DISCORD_TOKEN = "your-bot-token"
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
        "DISCORD_TOKEN": "your-bot-token"
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
        "DISCORD_TOKEN": "your-bot-token"
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

From-source alternative:

```json
{
  "servers": {
    "discord": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
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

## MCP Inspector

Primary (`npx`):

```sh
npx @modelcontextprotocol/inspector -- npx -y @qungtai/discord-mcp
```

From source:

```sh
npx @modelcontextprotocol/inspector -- node /absolute/path/dist/index.js
```

Set `DISCORD_TOKEN` in the inspector environment panel before connecting.

## Approval support in each client

Destructive tools ask for confirmation with MCP elicitation (`elicitation/create`). The client must advertise the `elicitation` capability, otherwise the tool is refused with a `policy` error.

- Claude Code 2.1.309 was verified on 3 November 2026 to show the approval dialog and accept it end to end.
- Codex 0.166.0 was verified on 3 November 2026: with approval mode on-request (`codex -a on-request`) it first asks to allow the MCP tool call and then shows the server approval prompt, and accepting runs the tool end to end; in full-access mode Codex declines the elicitation without asking, so destructive tools return "Approval declined". Use on-request for destructive tools, or set `DISCORD_MCP_APPROVAL=none` if you rely on Codex's own approvals.
- Other clients: check your client. If it does not support elicitation, set `DISCORD_MCP_APPROVAL=none` and rely on the client tool confirmation.

## File access

Local file access is open by default:

- Uploads: Any absolute path is accessible by default, except hidden files and directories (paths containing a segment starting with `.`). To restrict access, set `DISCORD_MCP_FILE_ROOTS` to a comma-separated list of allowed directories.
- Downloads: Attachments downloaded with `discord_download_attachment` save to `~/Downloads/discord-mcp` by default. You can change this path by setting `DISCORD_MCP_DOWNLOAD_DIR`. The directory is created automatically on first download.

## Environment variables

For the full list of configuration variables and their behaviors, see the [Configuration section in README.md](../README.md#configuration).
