FROM node:22-slim

WORKDIR /app
RUN npm install --global corepack@latest && corepack enable
COPY --chown=node:node . .
USER node

# Build-time placeholder values satisfy Prisma schema loading only; they are never used to connect to a database.
RUN corepack pnpm install --frozen-lockfile \
    && NEON_DATABASE_URL='postgresql://build:build@127.0.0.1:5432/hemip?sslmode=require' \
       NEON_DIRECT_URL='postgresql://build:build@127.0.0.1:5432/hemip?sslmode=require' \
       corepack pnpm prisma:generate \
    && corepack pnpm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
