# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agentflow/core build
RUN pnpm --filter @agentflow/ui build
RUN pnpm --filter @agentflow/web build

# Stage 2: Serve
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
