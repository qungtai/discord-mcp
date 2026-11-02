# Client configuration (stdio)

All examples run the built server with Node over stdio. Replace
`/absolute/path` with the absolute path to your checkout's `dist/index.js`.
Pass the bot token through the environment; never put it in a tool argument.

The standard `npx -y @qungtai/discord-mcp@<version>` install path will be available
after the first release.

## Claude Code

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

## Codex (config.toml)

```toml
[mcp_servers.discord]
command = "node"
args = ["/absolute/path/dist/index.js"]

[mcp_servers.discord.env]
DISCORD_TOKEN = "your-bot-token"
```

## Cursor

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

```json
{
  "servers": {
    "discord": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token"
      }
    }
  }
}
```

## MCP Inspector

```sh
npx @modelcontextprotocol/inspector node /absolute/path/dist/index.js
```

Set `DISCORD_TOKEN` in the inspector's environment panel before connecting.

## Optional environment variables

- `DISCORD_MCP_ALLOWED_GUILDS` - comma-separated guild IDs; empty means no
  restriction
- `DISCORD_MCP_TOOLSETS` - comma-separated toolsets; default `core,messages`
- `DISCORD_MCP_READ_ONLY` - `true` blocks mutating tools
- `DISCORD_MCP_APPROVAL` - `elicitation` (default) or `none`. In `elicitation`
  mode, destructive operations ask the user for confirmation using MCP
  elicitation (`elicitation/create`). In `none` mode, server-side approval for
  destructive tools is disabled: those tools run without elicitation and rely on
  the client's own tool confirmation, which is not a security boundary. The
  server prints a warning to stderr at startup in `none` mode. Clients without
  MCP elicitation support need `DISCORD_MCP_APPROVAL=none`.
- `DISCORD_MCP_FILE_ROOTS` - comma-separated absolute directories readable for
  uploads
- `DISCORD_MCP_DOWNLOAD_DIR` - absolute directory for downloads
