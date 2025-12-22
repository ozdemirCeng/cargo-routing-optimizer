# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps

RUN apk add --no-cache openssl libc6-compat curl
WORKDIR /app

COPY package.json ./
RUN npm install


FROM node:20-alpine AS build

RUN apk add --no-cache openssl libc6-compat curl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Retry logic for Prisma generate (network issues on ARM64)
RUN for i in 1 2 3 4 5; do npx prisma generate && break || sleep 5; done
RUN npm run build
RUN npm prune --omit=dev


FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Regenerate Prisma client for runtime
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/main"]
