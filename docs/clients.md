# Client configuration (stdio)

All examples run the built server with Node over stdio. Replace
`/absolute/path` with the absolute path to your checkout's `dist/index.js`.
Pass the bot token through the environment; never put it in a tool argument.

The standard `npx -y @qungtai/discord-mcp@<version>` install path will be
available after the first release. Until then, build from source.

> Warning: never commit a real bot token. Prefer environment passthrough or a
> secret store over plaintext tokens in shared config files.

## Claude Code

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "${DISCORD_TOKEN}"
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
        "DISCORD_TOKEN": "${DISCORD_TOKEN}"
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
DISCORD_TOKEN = "${DISCORD_TOKEN}"
```

## Cursor

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "${DISCORD_TOKEN}"
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
        "DISCORD_TOKEN": "${DISCORD_TOKEN}"
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
- `DISCORD_MCP_FILE_ROOTS` - comma-separated absolute directories readable for
  uploads
- `DISCORD_MCP_DOWNLOAD_DIR` - absolute directory for downloads
