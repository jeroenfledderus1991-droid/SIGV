FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        python3 \
        python3-dotenv \
        python3-matplotlib \
        python3-pandas \
        python3-pyodbc \
        python3-reportlab \
        unixodbc \
        unixodbc-dev \
        build-essential \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/microsoft-prod.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

WORKDIR /app
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY client/public/SIGV-logo.jpg ./client/public/SIGV-logo.jpg

WORKDIR /app/server

EXPOSE 5010

CMD ["node", "src/index.js"]
