FROM node:20-alpine
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./

EXPOSE 5010

CMD ["node", "src/index.js"]
