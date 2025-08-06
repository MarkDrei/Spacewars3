export abstract class SpaceObject {
    protected x: number;
    protected y: number;
    protected angle: number; // Always in degrees (0-360)
    protected speed: number;
    protected isHovered: boolean;
    public static readonly HOVER_RADIUS = 20;

    constructor(x: number, y: number, angleDegrees: number, speed: number) {
        this.x = x;
        this.y = y;
        this.angle = angleDegrees; // Store in degrees
        this.speed = speed;
        this.isHovered = false;
    }

    getX(): number {
        return this.x;
    }

    getY(): number {
        return this.y;
    }

    setX(x: number): void {
        this.x = x;
    }

    setY(y: number): void {
        this.y = y;
    }

    getAngle(): number {
        return this.angle; // Returns degrees
    }

    getAngleDegrees(): number {
        return this.angle; // Returns degrees
    }

    getAngleRadians(): number {
        return this.angle * Math.PI / 180; // Convert degrees to radians for rendering
    }

    getSpeed(): number {
        return this.speed;
    }

    setAngle(angleDegrees: number): void {
        this.angle = angleDegrees; // Store in degrees
    }

    setSpeed(speed: number): void {
        this.speed = speed;
    }

    // NOTE: updatePosition removed - all positions come from server
    // updatePosition(deltaTime: number): void {
    //     if (this.speed === 0) return;
    //     this.x += this.speed * Math.cos(this.angle) * deltaTime;
    //     this.y += this.speed * Math.sin(this.angle) * deltaTime;
    // }

    isPointInHoverRadius(pointX: number, pointY: number): boolean {
        const dx = pointX - this.x;
        const dy = pointY - this.y;
        return (dx * dx + dy * dy) <= (SpaceObject.HOVER_RADIUS * SpaceObject.HOVER_RADIUS);
    }

    setHovered(hovered: boolean): void {
        this.isHovered = hovered;
    }

    isHoveredState(): boolean {
        return this.isHovered;
    }

    getHoverRadius(): number {
        return SpaceObject.HOVER_RADIUS;
    }
} 