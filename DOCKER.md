# Docker Setup Guide

This guide explains how to use Docker for developing and deploying Spacewars3.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [GitHub Codespaces](#github-codespaces)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Local Development
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2+
- Git
- **Minimum 8GB RAM allocated to Docker** (required for dev containers)

### Windows-Specific
- WSL2 (Windows Subsystem for Linux)
- Docker Desktop with WSL2 backend enabled
- **WSL 2 Memory Configuration:**
  - WSL 2 uses 50% of your system RAM by default
  - For systems with 16GB+ RAM, this is usually sufficient
  - To customize, create `%UserProfile%\.wslconfig` with:
    ```ini
    [wsl2]
    memory=8GB
    processors=4
    ```
  - Then run `wsl --shutdown` in PowerShell to apply

### Verify Installation
```bash
docker --version        # Should be 20.0+
docker-compose --version # Should be 2.0+
```

## Quick Start

### Development Mode (Recommended)

```bash
# Clone the repository
git clone https://github.com/MarkDrei/Spacewars3.git
cd Spacewars3

# Start development server with hot reload
docker-compose up dev
```

The application will be available at `http://localhost:3000`.

### Production Mode (Local Testing)

```bash
# Build and start production container
docker-compose up prod
```

## Development Workflow

### Starting Development Server

```bash
# Start in foreground (see logs)
docker-compose up dev

# Start in background (detached mode)
docker-compose up -d dev

# View logs
docker-compose logs -f dev
```

### Making Code Changes

1. Edit files in your IDE/editor as usual
2. Changes are automatically synced to the container
3. Next.js hot reload will refresh the browser
4. No need to restart the container

### Running Commands in Container

```bash
# Run tests
docker-compose exec dev npm test

# Run linting
docker-compose exec dev npm run lint

# Open bash shell in container
docker-compose exec dev bash

# Run any npm command
docker-compose exec dev npm run <command>
```

### Stopping the Container

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

### Rebuilding After Dependency Changes

```bash
# Rebuild the image
docker-compose build dev

# Or rebuild and start
docker-compose up --build dev
```

## Production Deployment

### Building Production Image

```bash
# Build the optimized production image
docker build -t spacewars3:latest .

# Or use docker-compose
docker-compose build prod
```

### Running Production Container

```bash
# Using docker run
docker run -d \
  --name spacewars3 \
  -p 3000:3000 \
  -v $(pwd)/database:/app/database \
  -e SESSION_SECRET=your-strong-random-secret-here \
  -e NODE_ENV=production \
  spacewars3:latest

# Using docker-compose
docker-compose up -d prod
```

### Environment Variables for Production

Create a `.env` file in the project root:

```env
SESSION_SECRET=your-strong-random-secret-change-this
NODE_ENV=production
```

### Container Orchestration

For production deployment with multiple containers, consider using:
- **Docker Swarm**: Built-in Docker orchestration
- **Kubernetes**: Enterprise-grade orchestration
- **Cloud Services**: AWS ECS, Azure Container Instances, Google Cloud Run

## GitHub Codespaces

### Creating a Codespace

1. Go to the repository on GitHub
2. Click the "Code" button
3. Select "Codespaces" tab
4. Click "Create codespace on main"
5. Wait for the container to build (2-3 minutes)

### Working in Codespaces

Once the Codespace is ready:

```bash
# Dependencies are automatically installed
# Start the development server
npm run dev
```

The application will be available through the forwarded port (automatically detected).

### Codespace Features

- **Pre-installed**: Node.js 20, npm, git, bash
- **VSCode Extensions**: ESLint, Prettier, Tailwind CSS, TypeScript
- **Auto-configuration**: Port forwarding, environment variables
- **Persistent**: Changes to database persist between sessions

### Customizing Codespace

Edit `.devcontainer/devcontainer.json` to customize:
- Base image
- VSCode extensions
- Post-create commands
- Environment variables
- Port forwarding

## Advanced Configuration

### Custom Docker Compose Override

Create `docker-compose.override.yml` for local customization:

```yaml
version: '3.8'
services:
  dev:
    ports:
      - "3001:3000"  # Use different port
    environment:
      - DEBUG=*      # Enable debug mode
```

### Multi-Architecture Builds

Build for different platforms:

```bash
# Build for ARM64 (Apple Silicon, Raspberry Pi)
docker buildx build --platform linux/arm64 -t spacewars3:arm64 .

# Build for AMD64 (Intel/AMD)
docker buildx build --platform linux/amd64 -t spacewars3:amd64 .

# Build for both
docker buildx build --platform linux/amd64,linux/arm64 -t spacewars3:latest .
```

### Using Docker Networks

Create a custom network for multiple services:

```bash
# Create network
docker network create spacewars-network

# Run container on custom network
docker run -d --network spacewars-network --name spacewars3 spacewars3:latest
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect spacewars3_database

# Backup database
docker cp spacewars3:/app/database ./backup

# Restore database
docker cp ./backup/. spacewars3:/app/database
```

## Troubleshooting

## Troubleshooting

### VS Code Dev Container OOM Error (Exit Code 137)

**Symptom:** Container fails to start with "Exit code 137" or "Shell server terminated (code: 137)"

**Cause:** Out of Memory (OOM) kill during VS Code Server installation. This happens when Docker doesn't have enough memory allocated.

**Solution:**
1. **Increase Docker Desktop Memory:**
   - Open Docker Desktop → Settings → Resources
   - Set Memory to **at least 8GB** (recommended for dev containers)
   - Set CPUs to **4 or more**
   - Click "Apply & Restart"

2. **Remove old containers and try again:**
   ```bash
   docker-compose down -v
   docker system prune -a
   ```

3. **Close memory-intensive applications** before reopening the container

4. **Restart Docker Desktop** if the issue persists

### Port Already in Use

```bash
# Find process using port 3000
# On Linux/Mac:
lsof -i :3000

# On Windows (PowerShell):
netstat -ano | findstr :3000

# Kill the process or use a different port
docker-compose run -p 3001:3000 dev
```

### Permission Denied (Linux)

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs dev

# Check container status
docker-compose ps

# Remove and recreate containers
docker-compose down
docker-compose up --force-recreate dev
```

### Database Lock Issues

```bash
# Stop all containers
docker-compose down

# Remove SQLite lock files
rm -f database/*.db-wal database/*.db-shm

# Start fresh
docker-compose up dev
```

### Slow Performance on Windows

1. Ensure WSL2 is enabled (not WSL1)
2. Keep project files in WSL2 filesystem (not /mnt/c/)
3. Allocate more resources to Docker Desktop:
   - Settings → Resources → Adjust CPU/Memory

### Build Fails with Network Error

The Next.js build tries to fetch Google Fonts. In restricted networks:

1. This is normal in sandbox/restricted environments
2. The application still works in development mode
3. For production, ensure internet access during build

### Can't Access Application

```bash
# Check if container is running
docker-compose ps

# Check port forwarding
docker-compose port dev 3000

# Try accessing via 127.0.0.1 instead of localhost
curl http://127.0.0.1:3000
```

### Fresh Start

```bash
# Nuclear option: remove everything and start over
docker-compose down -v
docker system prune -a
docker-compose up --build dev
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [GitHub Codespaces Documentation](https://docs.github.com/en/codespaces)
- [Dev Containers Specification](https://containers.dev/)

## Support

If you encounter issues not covered here:
1. Check the main [README.md](../README.md)
2. Open an issue on GitHub
3. Review existing issues for similar problems
