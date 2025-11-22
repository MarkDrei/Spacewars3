# Quick Start Guide - Docker & Codespaces

## 🚀 Choose Your Development Environment

### Option 1: GitHub Codespaces (Easiest - Zero Setup)

**Best for:** Quick start, no local installation needed

```
1. Go to: https://github.com/MarkDrei/Spacewars3
2. Click "Code" → "Codespaces" → "Create codespace"
3. Wait 2-3 minutes for setup
4. Run: npm run dev
5. Open forwarded port (automatically detected)
```

✅ Everything pre-configured  
✅ Works on any device with a browser  
✅ Free tier: 60 hours/month

---

### Option 2: Local Docker Development (Recommended for Regular Development)

**Best for:** Local development with consistent environment

#### Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Git

#### Quick Start
```bash
# Clone the repository
git clone https://github.com/MarkDrei/Spacewars3.git
cd Spacewars3

# Start development server (with hot reload)
docker-compose up dev

# Access the app
open http://localhost:3000
```

✅ Hot reload - changes reflect immediately  
✅ Persistent database  
✅ Isolated from your system  

#### Common Commands
```bash
# Start development server
docker-compose up dev

# Start in background
docker-compose up -d dev

# View logs
docker-compose logs -f dev

# Stop containers
docker-compose down

# Rebuild after dependency changes
docker-compose up --build dev

# Run tests in container
docker-compose exec dev npm test

# Run linting in container
docker-compose exec dev npm run lint

# Open bash shell in container
docker-compose exec dev bash
```

---

### Option 3: Traditional Local Setup

**Best for:** Those who prefer traditional development

```bash
# Install Node.js 20+ and npm 8+
# Then:
git clone https://github.com/MarkDrei/Spacewars3.git
cd Spacewars3
npm install
npm run dev
```

---

## 📋 Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

For production, set a strong `SESSION_SECRET`:
```bash
SESSION_SECRET=your-strong-random-secret-here-minimum-32-characters
NODE_ENV=production
```

---

## 🐛 Troubleshooting

### Docker: Port 3000 already in use
```bash
docker-compose down
# Or use different port:
docker-compose run -p 3001:3000 dev
```

### Docker: Changes not reflecting
```bash
docker-compose down
docker-compose up --build dev
```

### Codespaces: Port not accessible
- Check "Ports" tab in VSCode
- Make port 3000 "Public"
- Click globe icon to open

### Database locked error
```bash
# Stop all instances
docker-compose down  # or stop local npm process

# Remove lock files
rm -f database/*.db-wal database/*.db-shm

# Restart
docker-compose up dev  # or npm run dev
```

---

## 📚 More Information

- **Full Docker Guide:** [DOCKER.md](DOCKER.md)
- **Project Documentation:** [README.md](README.md)
- **Technical Details:** Project uses Next.js 15, TypeScript, SQLite
- **Testing:** 402 tests with Vitest

---

## 🎮 Getting Started with the Game

Once the server is running:

1. Navigate to `http://localhost:3000`
2. Click "Login" and use default credentials:
   - Username: `a`
   - Password: `a`
3. Start playing! Click to move your ship
4. Collect asteroids and shipwrecks for iron
5. Use iron to research technologies

---

## 💡 Tips

- **Docker:** Use `dev` service for development, `prod` for testing production build
- **Codespaces:** Automatic port forwarding makes testing easy
- **Local:** Traditional setup works if you prefer no containerization
- **Database:** SQLite database auto-initializes on first run
- **Hot Reload:** Code changes automatically refresh in Docker dev mode

---

**Need Help?** 
- Check [DOCKER.md](DOCKER.md) for detailed Docker guide
- Check [README.md](README.md) for full project documentation
- Open an issue on GitHub
