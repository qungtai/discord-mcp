# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.build.json ./
RUN pnpm install --frozen-lockfile

COPY src ./src
RUN pnpm build

RUN pnpm prune --prod

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/qungtai/discord-mcp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.description="A community MCP server for the Discord REST API with traceable coverage"

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node

ENTRYPOINT ["node", "dist/index.js"]
