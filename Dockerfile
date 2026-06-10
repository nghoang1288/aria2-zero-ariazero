FROM debian:stable-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH

# Download AriaNg static files
RUN curl -L -o /tmp/ariang.zip https://github.com/mayswind/AriaNg/releases/download/1.3.13/AriaNg-1.3.13.zip \
    && mkdir -p /tmp/ariang \
    && unzip /tmp/ariang.zip -d /tmp/ariang

# Download the matching architecture of aria2-zero
# AMD64 uses v2026.06.10-release.1
# ARM64 falls back to v2025.04.06-release.1
RUN mkdir -p /tmp/aria2 && \
    if [ "$TARGETARCH" = "amd64" ] || [ "$TARGETARCH" = "x86_64" ] || [ -z "$TARGETARCH" ]; then \
        curl -L -o /tmp/aria2.zip https://github.com/zeromake/aria2-zero/releases/download/v2026.06.10-release.1/aria2-linux-x86_64.zip; \
    elif [ "$TARGETARCH" = "arm64" ] || [ "$TARGETARCH" = "aarch64" ]; then \
        curl -L -o /tmp/aria2.zip https://github.com/zeromake/aria2-zero/releases/download/v2025.04.06-release.1/aria2-linux-arm64-v8a.zip; \
    else \
        echo "Unsupported architecture: $TARGETARCH"; exit 1; \
    fi && \
    unzip /tmp/aria2.zip -d /tmp/aria2

FROM debian:stable-slim

# Install runtime dependencies: nginx, samba, supervisor, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx-light \
    samba \
    supervisor \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy aria2c binary and AriaNg static files from builder
COPY --from=builder /tmp/aria2/bin/aria2c /usr/local/bin/aria2c
RUN chmod +x /usr/local/bin/aria2c

# Remove default nginx pages and copy AriaNg files
RUN rm -rf /var/www/html/*
COPY --from=builder /tmp/ariang/ /var/www/html/

# Pre-configure AriaNg to dynamically connect to the current host and port via WebSockets
RUN sed -i 's/rpcHost:""/rpcHost:location.hostname/g' /var/www/html/aria-ng-*.js && \
    sed -i 's/rpcPort:"6800"/rpcPort:(location.port?location.port:(location.protocol==="https:"?"443":"80"))/g' /var/www/html/aria-ng-*.js && \
    sed -i 's/protocol:"http"/protocol:(location.protocol==="https:"?"wss":"ws")/g' /var/www/html/aria-ng-*.js

# Copy configurations
COPY nginx.conf /etc/nginx/sites-available/default
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose ports:
# 80: AriaNg WebUI (Nginx)
# 6800: Aria2 RPC (Direct access if needed)
# 445: SMB Server (Samba)
EXPOSE 80 6800 445

# Volumes for config and downloads
VOLUME ["/config", "/downloads"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
