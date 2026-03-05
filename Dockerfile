FROM node:20-alpine AS client-build
WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build


FROM node:20-alpine AS server-deps
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev


FROM node:20-alpine AS runtime
WORKDIR /app/server

ENV NODE_ENV=production

COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 5010

CMD ["node", "src/index.js"]
