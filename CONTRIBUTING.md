# Contributing

This project follows the rules in `AGENTS.md`. Summary:

- Package manager: pnpm. Install with `pnpm install`.
- Language: TypeScript, `strict: true`, ESM only, current Node LTS.
- Lint/format: Biome (`pnpm lint` runs `biome check .`).
- Type check: `pnpm typecheck`.
- Tests: vitest (`pnpm test` runs `vitest run --coverage`).
- Coverage gates: at least 80% lines and branches overall, 90% for `src/core`.
  `pnpm test` fails below these (thresholds in `vitest.config.ts`).
- Live tests are opt-in via env vars and run only against the test server
  (`1381945630808604713` with `lequangtaibot`). Never use project secrets on
  untrusted pull requests.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`, `refactor:`). No AI co-author or attribution lines.
- Branches: `feat/<toolset>-<task>`, `fix/<scope>-<task>`,
  `chore/<scope>-<task>`.
- One PR per task. The lead reviews and tests; the owner approves before merge
  to `main`. No force pushes to `main`.
- Nothing is published to npm, Docker or the MCP Registry without the owner's
  approval.
- Never print or commit credentials. Never modify production Discord resources.
- Code style: 2-space indentation, line width 100, double quotes, semicolons,
  trailing commas. No `any` to silence types, no swallowed errors, no
  `setTimeout` workarounds, no dead code.
