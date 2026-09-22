# syntax=docker/dockerfile:1

# ---- dependencies
FROM node:25-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build (also used by the compose "migrate" service, which needs the Prisma CLI)
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    STANDALONE=1 \
    # Placeholders so env validation passes at build time; real values are injected at runtime.
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DIRECT_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build-time-placeholder-secret
RUN npx prisma generate && npm run build

# ---- runtime: minimal standalone server
FROM node:25-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S nodejs && adduser -S nextjs -G nodejs
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
