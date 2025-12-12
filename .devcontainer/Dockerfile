# Development container with Node.js and PostgreSQL client tools
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install PostgreSQL client tools for debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspaces/Spacewars3
