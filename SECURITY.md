# Security policy

## Supported versions

| Version      | Supported          |
| ------------ | ------------------ |
| 0.x (latest) | :white_check_mark: |

Only the latest `0.x` release and current `main` branch receive security updates.

## Reporting a vulnerability

Please report security vulnerabilities through GitHub private vulnerability reporting:

1. Navigate to the repository's **Security** tab on GitHub.
2. Under "Reporting", click **Report a vulnerability** to open an advisory draft.

Do not report security vulnerabilities through public issues, discussions, or pull requests.

## Scope

Security issues of particular concern include:

- Token handling and credential leaks (exposure of bot tokens, OAuth tokens, or webhook secrets in arguments, responses, or logs)
- Guild or channel allowlist bypasses
- Local filesystem sandbox bypasses (unauthorized path access outside configured roots or system directories)
- Destructive action approval bypasses (executing mutating or destructive tools without required confirmation)

## Out of scope

- Bugs in third-party dependencies without direct exploitability in this server
- Attacks requiring direct local access to the machine running the MCP server process
- Discord API rate limiting or temporary upstream outages
