# Stage 1: Build the React Frontend WebUI
FROM node:20-slim AS webui-builder
WORKDIR /webui
COPY webui/package*.json ./
RUN npm install
COPY webui/ ./
RUN npm run build

# Stage 2: Download the matching architecture of aria2-zero
FROM debian:stable-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH

RUN mkdir -p /tmp/aria2 && \
    if [ "$TARGETARCH" = "amd64" ] || [ "$TARGETARCH" = "x86_64" ] || [ -z "$TARGETARCH" ]; then \
        curl -L -o /tmp/aria2.zip https://github.com/zeromake/aria2-zero/releases/download/v2026.06.10-release.1/aria2-linux-x86_64.zip; \
    elif [ "$TARGETARCH" = "arm64" ] || [ "$TARGETARCH" = "aarch64" ]; then \
        curl -L -o /tmp/aria2.zip https://github.com/zeromake/aria2-zero/releases/download/v2025.04.06-release.1/aria2-linux-arm64-v8a.zip; \
    else \
        echo "Unsupported architecture: $TARGETARCH"; exit 1; \
    fi && \
    unzip /tmp/aria2.zip -d /tmp/aria2

# Stage 3: Runtime container
FROM debian:stable-slim

# Install runtime dependencies: nginx, samba, supervisor, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx-light \
    samba \
    supervisor \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy aria2c binary from builder stage
COPY --from=builder /tmp/aria2/bin/aria2c /usr/local/bin/aria2c
RUN chmod +x /usr/local/bin/aria2c

# Remove default nginx pages and copy the compiled AriaZero React frontend
RUN rm -rf /var/www/html/*
COPY --from=webui-builder /webui/dist/ /var/www/html/

# Copy configurations
COPY nginx.conf /etc/nginx/sites-available/default
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose ports:
# 80: AriaZero WebUI (Nginx)
# 6800: Aria2 RPC (Direct access if needed)
# 445: SMB Server (Samba)
EXPOSE 80 6800 445

# Volumes for config and downloads
VOLUME ["/config", "/downloads"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
