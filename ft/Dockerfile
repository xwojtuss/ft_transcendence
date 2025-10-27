# ^^^^^ dckr ^^^^^
# Stage 1: builder — install all deps (including dev), build TS & CSS, generate certs
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install tools needed by scripts:
# - curl: used by import_babylon_d.sh to fetch Babylon typings
# - ca-certificates: so curl trusts HTTPS endpoints
# - bash: some scripts may use bashisms; Debian slim defaults to sh (dash)
# - openssl: used by generate_certs.sh
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates bash openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better Docker layer caching, then install deps
COPY package*.json ./
RUN npm ci

# Copy the rest of the project (scripts, TS sources, tailwind, etc.)
COPY . .

# Make sure helper scripts are executable (defensive, helps on Windows clones)
RUN chmod +x ./import_babylon_d.sh || true \
 && chmod +x ./generate_certs.sh || true

# Build frontend TS & CSS, download Babylon .d.ts, and generate HTTPS certs
# - creates ./frontend/ts/*.js and ./frontend/css/output.css
# - creates ./secrets/ft_transcendence.key and ./secrets/ft_transcendence.crt
RUN npm run build

# Stage 2: runner — small image, only production deps + built assets
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies (no dev deps in the final image)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app from builder stage (without dev node_modules)
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend
COPY --from=builder /app/tsconfig.json /app/tsconfig.json
# Copy the generated self-signed certs used by Fastify HTTPS
COPY --from=builder /app/secrets /app/secrets

# Create a logs directory and declare it as a volume (no host bind-mounts)
RUN mkdir -p /logs
VOLUME ["/logs"]

# Expose the Fastify port
EXPOSE 3000

# Make sure a default log file path is available inside the container
ENV LOG_FILE=/logs/ft_transcendence.jsonl

# Start the server (env vars come from docker-compose env_file)
CMD ["node", "backend/server.js"]
