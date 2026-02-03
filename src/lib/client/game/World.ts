import { SpaceObjectOld } from './SpaceObject';
import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
// import { Collectible } from './Collectible'; // DISABLED: Server handles collections
import { Player } from './Player';
import { Shipwreck } from './Shipwreck';
import { EscapePod } from './EscapePod';
import { WorldData, Asteroid as SharedAsteroid, Shipwreck as SharedShipwreck, EscapePod as SharedEscapePod } from '@shared/types/gameTypes';

export class World {

    private player: Player;
    private spaceObjects: SpaceObjectOld[];
    private hoveredObjectId?: number;
    
    // World boundaries
    public static WIDTH = 500;
    public static HEIGHT = 500;

    private static instance: World;

    static getInstance() {
        return this.instance;
    }

    constructor(initializeDefault: boolean = true) {
        this.spaceObjects = [];
        
        // TODO: remove entirely?
        if (initializeDefault) {
            // Initialize ship with default server data
            const defaultShipData = {
                id: -1, // Temporary ID for local ship
                type: 'player_ship' as const,
                x: 250,
                y: 250,
                speed: 20,
                angle: 0,
                last_position_update_ms: Date.now(),
                picture_id: 1
            };
            const ship = new Ship(defaultShipData);
            
            // Initialize player with ship
            this.player = new Player(ship);
            
            // Initialize space objects (including ship)
            this.spaceObjects = [ship];
        } else {
            // Create a dummy player ship that will be replaced by server data
            const dummyShipData = {
                id: -1, // Temporary ID for dummy ship
                type: 'player_ship' as const,
                x: 0,
                y: 0,
                speed: 0,
                angle: 0,
                last_position_update_ms: Date.now(),
                picture_id: 1
            };
            const dummyShip = new Ship(dummyShipData);
            this.player = new Player(dummyShip);
            // Don't add dummy ship to spaceObjects - it will be replaced by server data
        }
        World.instance = this; // Set singleton instance
    }

    // Getters
    getShip(): Ship {
        return this.player.getShip();
    }

    getSpaceObjects(): SpaceObjectOld[] {
        return this.spaceObjects;
    }
    
    // Get world dimensions
    getWidth(): number {
        return World.WIDTH;
    }
    
    getHeight(): number {
        return World.HEIGHT;
    }
    
    // Wrap a position to stay within world boundaries
    wrapPosition(x: number, y: number): { x: number, y: number } {
        // Wrap x-coordinate
        let wrappedX = x % World.WIDTH;
        if (wrappedX < 0) wrappedX += World.WIDTH;
        
        // Wrap y-coordinate
        let wrappedY = y % World.HEIGHT;
        if (wrappedY < 0) wrappedY += World.HEIGHT;
        
        return { x: wrappedX, y: wrappedY };
    }

    /**
     * Get the player object
     */
    getPlayer(): Player {
        return this.player;
    }

    // NOTE: Client-side physics updates removed - all positions come from server

    /**
     * Update the world with data received from the server
     */
    updateFromServerData(worldData: WorldData, playerShipId?: number): void {
        // Update world dimensions if they differ
        World.WIDTH = worldData.worldSize.width;
        World.HEIGHT = worldData.worldSize.height;
        
        // Clear current space objects except the player ship
        this.spaceObjects = [];
        
        // Convert server objects to client objects
        worldData.spaceObjects.forEach(serverObject => {
            let clientObject: SpaceObjectOld;
            
            switch (serverObject.type) {
                case 'player_ship':
                    // Create or update player ships (including other players)
                    clientObject = new Ship(serverObject);
                    break;
                    
                case 'asteroid': {
                    const asteroidData = serverObject as SharedAsteroid;
                    clientObject = new Asteroid(asteroidData);
                    break;
                }
                    
                case 'shipwreck': {
                    const shipwreckData = serverObject as SharedShipwreck;
                    clientObject = new Shipwreck(shipwreckData);
                    break;
                }
                    
                case 'escape_pod': {
                    const podData = serverObject as SharedEscapePod;
                    clientObject = new EscapePod(podData);
                    break;
                }
                    
                default:
                    console.warn('Unknown object type:', serverObject.type);
                    return;
            }
            
            // The server ID is now available through clientObject.getId()
            
            this.spaceObjects.push(clientObject);
        });
        
        // Update player ship reference - find the ship that matches playerShipId
        if (playerShipId) {
            const playerShips = this.spaceObjects.filter(obj => 
                obj instanceof Ship && obj.getId() === playerShipId
            ) as Ship[];
            
            if (playerShips.length > 0) {
                this.player = new Player(playerShips[0]);
                // console.log('🎯 Player ship identified:', { serverId: playerShipId, ship: playerShips[0] });
            } else {
                console.warn('⚠️  Player ship not found in world data:', { playerShipId, ships: this.spaceObjects.filter(obj => obj instanceof Ship) });
            }
        } else {
            // Fallback: use first ship found if no playerShipId provided
            const playerShips = this.spaceObjects.filter(obj => obj instanceof Ship);
            if (playerShips.length > 0) {
                this.player = new Player(playerShips[0] as Ship);
                // console.log('🎯 Using first ship as player (no shipId provided)');
            }
        }
    }

    // Update hover states for all objects based on mouse position
    updateHoverStates(worldMouseX: number, worldMouseY: number): void {
        // First, clear all hover states
        this.spaceObjects.forEach(obj => {
            obj.setHovered(false);
        });
        this.hoveredObjectId = undefined;
        
        // Wrap mouse position to world boundaries
        const wrappedMouse = this.wrapPosition(worldMouseX, worldMouseY);
        
        // Then, set hover state for objects under the mouse
        this.spaceObjects.forEach(obj => {
            // Check if the object is hovered at its current position
            if (obj.isPointInHoverRadius(wrappedMouse.x, wrappedMouse.y)) {
                obj.setHovered(true);
                this.hoveredObjectId = obj.getId();
                return;
            }
            
            // Check for hover near world edges (for wrapped objects)
            this.checkWrappedHover(obj, wrappedMouse.x, wrappedMouse.y);
        });
    }
    
    // Check if an object is hovered when considering wrapping
    private checkWrappedHover(obj: SpaceObjectOld, mouseX: number, mouseY: number): void {
        const objX = obj.getX();
        const objY = obj.getY();
        const radius = obj.getHoverRadius();
        
        // Check all 8 possible wrapped positions around the world edges
        const positions = [
            { x: objX - World.WIDTH, y: objY },                  // Left
            { x: objX + World.WIDTH, y: objY },                  // Right
            { x: objX, y: objY - World.HEIGHT },                 // Top
            { x: objX, y: objY + World.HEIGHT },                 // Bottom
            { x: objX - World.WIDTH, y: objY - World.HEIGHT },   // Top-Left
            { x: objX + World.WIDTH, y: objY - World.HEIGHT },   // Top-Right
            { x: objX - World.WIDTH, y: objY + World.HEIGHT },   // Bottom-Left
            { x: objX + World.WIDTH, y: objY + World.HEIGHT }    // Bottom-Right
        ];
        
        // Check if any of these positions are within hover radius
        for (const pos of positions) {
            const dx = mouseX - pos.x;
            const dy = mouseY - pos.y;
            if (dx * dx + dy * dy <= radius * radius) {
                obj.setHovered(true);
                this.hoveredObjectId = obj.getId();
                return;
            }
        }
    }

    // Find a hovered object that isn't the ship
    findHoveredObject(): SpaceObjectOld | undefined {
        const ship = this.getShip();
        return this.spaceObjects.find(obj => obj !== ship && obj.isHoveredState());
    }

    getHoveredObjectId(): number | undefined {
        return this.hoveredObjectId;
    }

    /**
     * Set the ship's angle directly
     */
    setShipAngle(angle: number): void {
        const ship = this.getShip();
        ship.setAngle(angle);
    }

    /**
     * Add a space object to the world
     */
    addSpaceObject(object: SpaceObjectOld): void {
        this.spaceObjects.push(object);
    }

    /**
     * Remove a space object from the world
     */
    removeSpaceObject(object: SpaceObjectOld): void {
        const index = this.spaceObjects.indexOf(object);
        if (index !== -1) {
            this.spaceObjects.splice(index, 1);
        }
    }

    /**
     * Check for collisions between the ship and any collectibles
     * NOTE: Disabled - collections now handled by server
     */
    private checkCollectibleCollisions(): void {
        // DISABLED: Server now handles all collections via /api/collect endpoint
        return;
        /*
        const ship = this.getShip();
        
        const collectionRadius = 30; // Radius for collecting objects (larger than hover radius)
        
        // Get all collectibles
        const collectibles = this.spaceObjects.filter(
            obj => obj instanceof Collectible && !((obj as Collectible).isCollectedState())
        ) as Collectible[];
        
        // Track if we've collected anything to spawn a new object
        let hasCollectedObject = false;
        
        // Check each collectible for collision with ship
        collectibles.forEach(collectible => {
            // Calculate minimum distance (considering wrapping)
            const minDistance = this.getMinDistanceInWrappedWorld(
                ship.getX(), ship.getY(),
                collectible.getX(), collectible.getY()
            );
            
            // If ship is close enough, collect the item
            if (minDistance <= collectionRadius) {
                // Apply collectible effect and update player stats
                this.player.collectItem(collectible);
                hasCollectedObject = true;
            }
        });
        
        // Remove collected objects from the world
        this.removeCollectedObjects();
        
        // Spawn a new random object if something was collected
        if (hasCollectedObject) {
            this.spawnRandomObject();
        }
        */
    }

    /**
     * Calculate minimum distance between two points in a wrapped world
     */
    private getMinDistanceInWrappedWorld(x1: number, y1: number, x2: number, y2: number): number {
        // Check all 9 possible positions (wrapping around edges)
        const worldWidth = World.WIDTH;
        const worldHeight = World.HEIGHT;
        
        let minDistanceSquared = Number.MAX_VALUE;
        
        // Try all combinations of wrapping in x and y directions
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const wrappedX = x2 + dx * worldWidth;
                const wrappedY = y2 + dy * worldHeight;
                
                const distX = wrappedX - x1;
                const distY = wrappedY - y1;
                const distSquared = distX * distX + distY * distY;
                
                minDistanceSquared = Math.min(minDistanceSquared, distSquared);
            }
        }
        
        return Math.sqrt(minDistanceSquared);
    }

    /**
     * Remove all collected objects from the world
     * NOTE: Disabled - collections now handled by server
     */
    private removeCollectedObjects(): void {
        // DISABLED: Server handles object removal
        return;
        /*
        this.spaceObjects = this.spaceObjects.filter(obj => {
            if (obj instanceof Collectible) {
                return !obj.isCollectedState();
            }
            return true;
        });
        */
    }

    /**
     * Update the player's ship reference
     */
    setPlayerShip(ship: Ship): void {
        // First, add the ship to space objects if it's not already there
        if (!this.spaceObjects.includes(ship)) {
            this.addSpaceObject(ship);
        }
        
        // Create a new player with the ship
        this.player = new Player(ship);
    }

} 