# Security policy

## Reporting a vulnerability

Please report security vulnerabilities privately. Do not open a public issue
or pull request describing the vulnerability. Contact the maintainer at
`lequangtai1602@gmail.com` with details, reproduction steps and impact. You
will receive a response acknowledging receipt; fixes are released through the
normal release process.

## Secrets

- Never post, commit or share bot tokens, webhook URLs, OAuth refresh tokens
  or other credentials.
- `DISCORD_TOKEN` is resolved from the environment inside the server. It is
  never a tool argument and is never logged.
- Redact secrets in all logs and errors.

## Supported versions

Pre-release: only the latest commit on `main` receives security fixes until
the first published release.
