import { SpaceObject as SharedSpaceObject } from '@shared/types/gameTypes';

export abstract class SpaceObjectOld {
    protected serverData: SharedSpaceObject;
    protected isHovered: boolean;
    public static readonly HOVER_RADIUS = 20;

    constructor(serverData: SharedSpaceObject) {
        this.serverData = serverData;
        this.isHovered = false;
    }

    getServerData(): SharedSpaceObject {
        return this.serverData;
    }

    getX(): number {
        return this.serverData.x;
    }

    getY(): number {
        return this.serverData.y;
    }

    setX(x: number): void {
        this.serverData.x = x;
    }

    setY(y: number): void {
        this.serverData.y = y;
    }

    getAngle(): number {
        return this.serverData.angle; // Returns degrees
    }

    getAngleDegrees(): number {
        return this.serverData.angle; // Returns degrees
    }

    getAngleRadians(): number {
        return this.serverData.angle * Math.PI / 180; // Convert degrees to radians for rendering
    }

    getSpeed(): number {
        return this.serverData.speed;
    }

    setAngle(angleDegrees: number): void {
        this.serverData.angle = angleDegrees; // Store in degrees
    }

    setSpeed(speed: number): void {
        this.serverData.speed = speed;
    }

    getId(): number {
        return this.serverData.id;
    }

    getType(): string {
        return this.serverData.type;
    }

    getUserId(): number | undefined {
        return 'userId' in this.serverData ? (this.serverData as { userId: number }).userId : undefined;
    }

    getLastPositionUpdateMs(): number {
        return this.serverData.last_position_update_ms;
    }

    // Update the object with new server data
    updateFromServer(newServerData: SharedSpaceObject): void {
        this.serverData = newServerData;
    }

    // NOTE: updatePosition removed - all positions come from server
    // updatePosition(deltaTime: number): void {
    //     if (this.speed === 0) return;
    //     this.x += this.speed * Math.cos(this.angle) * deltaTime;
    //     this.y += this.speed * Math.sin(this.angle) * deltaTime;
    // }

    isPointInHoverRadius(pointX: number, pointY: number): boolean {
        const dx = pointX - this.getX();
        const dy = pointY - this.getY();
        return (dx * dx + dy * dy) <= (SpaceObjectOld.HOVER_RADIUS * SpaceObjectOld.HOVER_RADIUS);
    }

    setHovered(hovered: boolean): void {
        this.isHovered = hovered;
    }

    isHoveredState(): boolean {
        return this.isHovered;
    }

    getHoverRadius(): number {
        return SpaceObjectOld.HOVER_RADIUS;
    }
} 