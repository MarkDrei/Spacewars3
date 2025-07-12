# Spacewars Ironcore - Server

The backend server for Spacewars Ironcore. This package provides authentication, user data storage, and game state persistence.

## Features

- User authentication and session management with bcrypt password hashing
- User registration and login endpoints
- Session-based authentication with HTTP-only cookies
- Player stats and progress tracking with tech tree system
- Iron resource management and passive income mechanics
- Research system with upgrade costs and durations
- SQLite database for data storage
- RESTful API for client communication
- CORS configuration for development

## Development

```bash
# Install dependencies
npm install

# Initialize the database
npm run init-db

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```
