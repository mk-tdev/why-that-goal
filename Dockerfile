FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run audit:licenses && npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 STATIC_DIRECTORY=/app/dist
WORKDIR /app
# Only runtime dependencies, including the TypeScript loader.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/core ./src/core
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md
COPY --from=build --chown=node:node /app/third_party ./third_party
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "server/index.ts"]
