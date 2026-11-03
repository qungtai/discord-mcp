# Build stage
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.build.json LICENSE ./
RUN pnpm install --frozen-lockfile

COPY src ./src
RUN pnpm build

RUN pnpm prune --prod

# Production stage
FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS runner

ARG VERSION
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/qungtai/discord-mcp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.description="A community MCP server for the Discord REST API with traceable coverage"
LABEL org.opencontainers.image.version="${VERSION}"

COPY --from=builder /app/package.json ./
COPY --from=builder /app/LICENSE ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node

ENTRYPOINT ["node", "dist/index.js"]
