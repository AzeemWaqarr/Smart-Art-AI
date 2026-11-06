# Smart Art – single container: API + PWA on one port.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# keeps dev dependencies: the prisma CLI and tsx are used at start-up for schema sync and seeding
COPY --from=build /app /app
# Data lives in volumes: the SQLite database and uploaded drawings
ENV DATABASE_URL=file:/data/smartart.db UPLOAD_DIR=/data/uploads PORT=4000
VOLUME ["/data"]
EXPOSE 4000
WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx src/seed.ts && node dist/index.js"]
