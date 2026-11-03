# Build stage
FROM --platform=$BUILDPLATFORM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.build.json LICENSE ./
RUN pnpm install --frozen-lockfile

COPY src ./src
RUN pnpm build

RUN pnpm prune --prod

# Production stage
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runner

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
