# Deployment Guide

This guide covers deploying Sagittarius to production. Choose the option that best fits your infrastructure.

---

## Table of Contents

1. [Quick Deploy with Built-in Server](#option-1-built-in-production-server)
2. [Static Hosting with Nginx](#option-2-nginx--static-files)
3. [Docker Deployment](#option-3-docker)
4. [Environment Variables](#environment-variables)
5. [HTTPS & SSL](#https--ssl)
6. [Troubleshooting](#troubleshooting)

---

## Option 1: Built-in Production Server (Recommended)

The easiest way to deploy Sagittarius. The included Node.js server handles both static files and JMAP proxying.

### Setup

```bash
# Build the application
npm run build

# Install production dependencies only
npm ci --production

# Start server
JMAP_SERVER=https://mail.example.com PORT=8081 node server.js
```

### Systemd Service

Create `/etc/systemd/system/sagittarius.service`:

```ini
[Unit]
Description=Sagittarius JMAP Web Client
After=network.target

[Service]
Type=simple
User=sagittarius
WorkingDirectory=/opt/sagittarius
Environment="JMAP_SERVER=https://mail.example.com"
Environment="PORT=8081"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable sagittarius
sudo systemctl start sagittarius
```

### Nginx Reverse Proxy (Recommended)

If you want HTTPS and custom domains:

```nginx
server {
    listen 443 ssl http2;
    server_name mail.example.com;

    ssl_certificate /etc/letsencrypt/live/mail.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name mail.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Option 2: Nginx + Static Files

Host the built files directly with Nginx, proxying JMAP requests to your mail server.

### Build

```bash
npm run build
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name mail.example.com;
    root /var/www/sagittarius/dist;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/mail.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy JMAP requests to mail server
    location /jmap {
        proxy_pass https://mail-backend.example.com/jmap;
        proxy_http_version 1.1;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Authorization $http_authorization;
        proxy_buffering off;
        
        # Required for attachment downloads
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
    }

    # Proxy WebSocket for push notifications
    location /jmap/ws {
        proxy_pass https://mail-backend.example.com/jmap/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Important Notes

- Ensure CORS headers allow your domain on the JMAP server
- The `Authorization` header must be passed through for Basic Auth
- `Range` header support is required for attachment downloads
- **Content Security Policy (CSP):** Sagittarius uses a strict CSP (`connect-src 'self'`) for security. The frontend automatically rewrites JMAP WebSocket URLs to use the same origin (your domain), and the server proxies them to the actual JMAP backend. No CSP configuration needed.

---

## Content Security Policy

Sagittarius ships with a strict, production-ready CSP:

```
default-src 'self'
script-src 'self'
style-src 'self'
connect-src 'self'
img-src 'self' data: blob:
font-src 'self'
media-src 'self' blob:
frame-ancestors 'none'
object-src 'none'
```

**Key points:**
- No `'unsafe-inline'` or `'unsafe-eval'`
- No external domains in `connect-src`
- WebSocket connections use same-origin proxying (automatic)
- All JMAP requests go through `/jmap` proxy

---

## Option 3: Docker

### Using Docker Run

```bash
# Build image
docker build -t sagittarius:latest .

# Run container
docker run -d \
  --name sagittarius \
  -p 8081:8081 \
  -e JMAP_SERVER=https://mail.example.com \
  -e PORT=8081 \
  --restart always \
  sagittarius:latest
```

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  sagittarius:
    build: .
    container_name: sagittarius
    ports:
      - "8081:8081"
    environment:
      - JMAP_SERVER=https://mail.example.com
      - PORT=8081
    restart: unless-stopped
    # Optional: mount custom assets
    volumes:
      - ./custom-branding:/app/public/custom:ro
```

Run:

```bash
docker-compose up -d
```

### Multi-Stage Dockerfile

Create `Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

EXPOSE 8081
ENV PORT=8081
ENV NODE_ENV=production

CMD ["node", "server.js"]
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JMAP_SERVER` | JMAP backend URL | `http://localhost:8080` |
| `PORT` | Server port | `8081` |
| `NODE_ENV` | Environment mode | `production` |

---

## HTTPS & SSL

### Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d mail.example.com

# Auto-renewal is set up automatically
```

### Behind a Load Balancer

If running behind a load balancer (AWS ALB, etc.):

```nginx
# Trust the X-Forwarded-Proto header
location / {
    proxy_pass http://localhost:8081;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    # ... other headers
}
```

---

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console, your JMAP server needs to allow the Sagittarius domain:

**Stalwart Example:**
```toml
[server.http]
allowed-origins = ["https://mail.example.com"]
```

### Authentication Issues

Ensure the `Authorization` header is passed through:

```nginx
# Nginx must forward Authorization header
proxy_set_header Authorization $http_authorization;
```

### WebSocket Connection Fails

Check that your proxy supports WebSocket upgrade:

```nginx
location /jmap/ws {
    proxy_pass https://mail-backend.example.com/jmap/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### EventSource Push Not Connecting (Stalwart)

**Important:** Stalwart's EventSource endpoint requires `Authorization` header authentication, but browsers cannot send custom headers with the EventSource API. Sagittarius works around this by passing credentials as an `access_token` query parameter.

**Solution A: Use WebSocket (Recommended)**

Stalwart supports JMAP over WebSocket (RFC 8887), which handles authentication properly. Sagittarius automatically prefers WebSocket when available. Ensure your nginx config includes WebSocket support (see above).

**Solution B: Add nginx auth rewriting for EventSource**

If WebSocket is unavailable, add this to convert `access_token` to `Authorization` header:

```nginx
location /jmap/eventsource {
    # Convert access_token query param to Authorization header
    set $auth_header "";
    if ($arg_access_token) {
        set $auth_header "Basic $arg_access_token";
    }

    proxy_pass https://mail-backend.example.com/jmap/eventsource;
    proxy_http_version 1.1;
    proxy_set_header Authorization $auth_header;
    proxy_set_header Host $proxy_host;
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    
    # SSE-specific settings
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

**Note:** The `access_token` contains Base64-encoded credentials. Using HTTPS is mandatory to protect these in transit.

### Attachment Downloads Fail

Verify `Range` header support:

```nginx
proxy_set_header Range $http_range;
proxy_set_header If-Range $http_if_range;
```

### Attachment Uploads Fail (413 Request Entity Too Large)

If you see **"413 Request Entity Too Large"** when attaching files, nginx's default upload limit (1MB) is blocking larger files.

**Solution:** Increase `client_max_body_size` in your nginx config to match your JMAP server's limit (usually 50MB):

```nginx
server {
    listen 443 ssl;
    server_name mail.example.com;
    
    # Increase max upload size (default is 1MB)
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:8081;
        # ... other proxy settings
    }
}
```

Then reload nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Note:** The JMAP protocol (RFC 8620) supports up to 50MB uploads by default (`maxSizeUpload` capability). Ensure both nginx and your JMAP server are configured to accept your desired maximum file size.

---

## Security Checklist

- [ ] HTTPS enabled (Let's Encrypt or custom cert)
- [ ] HSTS headers configured
- [ ] Secure cookies if implementing remember-me
- [ ] Rate limiting on JMAP proxy
- [ ] JMAP server validates `Origin` header
- [ ] No sensitive data in browser logs (already handled by Sagittarius)

---

## Performance Optimization

### Enable Compression

The built-in server enables gzip automatically. For Nginx:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

### Cache Static Assets

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

Need more help? Check [GitHub Issues](https://github.com/SwordfishTrumpet/sagittarius/issues) or open a new discussion.
