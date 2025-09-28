# Spacewars Ironcore - Docker Setup

This project now runs in Docker containers for consistent development across environments.

## Quick Start

### Development (with hot reloading)
```bash
# Start development environment
docker-compose up

# Access the application at http://localhost:3000
```

### Production
```bash
# Build and start production environment
docker-compose -f docker-compose.prod.yml up --build
```

## VS Code Integration

### Using Dev Containers (Recommended)
1. Install the "Dev Containers" extension
2. Open Command Palette (Ctrl+Shift+P)
3. Select "Dev Containers: Reopen in Container"
4. VS Code will automatically build and connect to the container

### Manual Docker Commands
```bash
# Build development image
docker-compose build

# Start services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes to Dockerfile
docker-compose up --build
```

## Database Persistence

- SQLite database is stored in a Docker volume named `database_data`
- Data persists between container restarts
- To reset database: `docker-compose down -v` (removes volumes)

## Environment Variables

Copy `.env.example` to `.env.local` and customize:
```bash
cp .env.example .env.local
```

## GitHub Codespaces

This setup works automatically in GitHub Codespaces:
1. Create a new Codespace
2. Docker containers start automatically
3. Access the app via the forwarded port

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# Use different port
docker-compose up --scale app=1 -p 3001:3000
```

### Container Won't Start
```bash
# Check logs
docker-compose logs app

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Database Issues
```bash
# Reset database volume
docker-compose down -v
docker-compose up

# Access container shell
docker-compose exec app sh
```