# Spacewars Ironcore - Client

The frontend game client for Spacewars Ironcore. This package contains the game engine, rendering components, and user interface.

## Features

- 2D space exploration with a toroidal world
- HTML5 Canvas-based rendering
- Component-based architecture
- Interception mechanics and radar system
- React-based UI with routing and authentication flow
- Complete user authentication (register, login, logout)
- Protected routes and session management
- Responsive navigation with mobile support
- User profile and about pages

## Architecture

The client is structured following a clear separation of concerns:

### UI Layer
- **React Components**: For pages, navigation, and game container
- **React Router**: For handling navigation between login and game
- **Authentication Flow**: Complete registration/login with backend integration
- **Protected Routes**: Game, profile, and about pages require authentication
- **Responsive Navigation**: Mobile-friendly navbar with hamburger menu

### Game Core
- **Game**: Main controller that initializes canvas, world, and manages the game loop
- **World**: Manages all game objects, collisions, and world boundaries
- **SpaceObject**: Base class for all objects in the game (Ship, Collectibles, etc.)
- **Player**: Handles player state, inventory, and scoring

### Rendering
- **GameRenderer**: Coordinates rendering of all game elements
- **Specialized Renderers**: For ship, collectibles, radar, etc.

### Project Structure
```
src/
├── components/   # Reusable UI components
│   └── Navigation/ # Responsive navigation component
├── hooks/        # Custom React hooks (useAuth)
├── pages/        # Page components
│   ├── Login/    # Authentication page (login/register)
│   ├── Game/     # Game page with canvas
│   ├── About/    # About page with game info
│   └── Profile/  # User profile and statistics
├── renderers/    # Canvas rendering classes
├── services/     # API services (authService)
├── worlds/       # World configurations
├── App.tsx       # Main app component with routing and auth
├── Game.ts       # Game controller class
├── main.tsx      # Application entry point
└── ... other game classes (Ship.ts, World.ts, etc.)
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Flow
1. The application starts at `main.tsx`, rendering the React app
2. `App.tsx` handles routing and authentication:
   - Checks for existing user session on load
   - Non-authenticated users see the login/register page
   - Authenticated users are directed to the game page
   - Navigation is shown only to authenticated users
3. `LoginPage.tsx` handles user registration and login with backend API
4. `GamePage.tsx` renders the game canvas and HUD for authenticated users
5. `Game.ts` initializes the game world and starts the game loop
6. Mouse clicks and movements are captured and processed by the game
7. The game state is continuously updated and rendered to the canvas
8. Users can navigate between Game, About, and Profile pages via the navbar
