FROM node:20-alpine AS build
WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
