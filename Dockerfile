# ================================
# Production Dockerfile
# NestJS + Prisma
# ================================

FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build


# ================================
# Production runtime
# ================================

FROM node:22-alpine AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && \
    npx prisma generate && \
    npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

RUN mkdir -p /usr/src/app/uploads && \
    chown -R node:node /usr/src/app

USER node

EXPOSE 3000

CMD ["node", "dist/main"]
