FROM node:20-slim AS base

# Install git for update.sync mirroring
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --omit=dev

COPY src ./src
RUN npm run build

# Runtime
CMD ["node", "dist/server.js"]

# Notes:
# - SwiftFormat/SwiftLint/swift-format are NOT installed in this image.
#   The server will gracefully degrade if these binaries are missing.
# - Mount a volume with your Swift toolchain or extend this image to add them
#   if you need lint/format inside Docker.
