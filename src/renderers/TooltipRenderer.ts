import { Ship } from '../Ship';
import { SpaceObject } from '../SpaceObject';
import { Collectible } from '../Collectible';
import { Shipwreck, SalvageType } from '../Shipwreck';
import { EscapePod } from '../EscapePod';

export class TooltipRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }

    private calculateDistanceToShip(object: SpaceObject, ship: Ship): number {
        if (object === ship) return 0;
        
        const dx = object.getX() - ship.getX();
        const dy = object.getY() - ship.getY();
        return Math.sqrt(dx * dx + dy * dy);
    }

    drawTooltip(spaceObjects: SpaceObject[], ship: Ship): void {
        // Find the first hovered object
        const hoveredObject = spaceObjects.find(obj => obj.isHoveredState());
        
        if (!hoveredObject) return;
        
        // Calculate screen position for the tooltip
        let screenX: number;
        let screenY: number;
        
        if (hoveredObject === ship) {
            screenX = this.canvas.width / 2;
            screenY = this.canvas.height / 2;
        } else {
            screenX = this.canvas.width / 2 + hoveredObject.getX() - ship.getX();
            screenY = this.canvas.height / 2 + hoveredObject.getY() - ship.getY();
        }
        
        // Get object information
        const tooltipText = this.getTooltipTextForObject(hoveredObject, ship);
        
        // Draw tooltip background
        const padding = 5;
        const lineHeight = 20;
        const tooltipWidth = 180;
        const tooltipHeight = tooltipText.length * lineHeight + padding * 2;
        
        // Position tooltip to avoid going off-screen
        const tooltipX = Math.min(screenX + 30, this.canvas.width - tooltipWidth - 5);
        const tooltipY = Math.min(screenY - tooltipHeight - 10, this.canvas.height - tooltipHeight - 5);
        
        // Draw tooltip background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        
        tooltipText.forEach((line, index) => {
            this.ctx.fillText(
                line, 
                tooltipX + padding, 
                tooltipY + padding + (index + 1) * lineHeight - 5
            );
        });
    }
    
    /**
     * Get tooltip text based on object type
     */
    private getTooltipTextForObject(object: SpaceObject, ship: Ship): string[] {
        // Calculate common properties
        const distance = this.calculateDistanceToShip(object, ship);
        const angleDegrees = Math.round((object.getAngle() * 180 / Math.PI + 360) % 360);
        
        // Check object type and create appropriate tooltip
        if (object === ship) {
            return [
                'Type: Ship',
                `Speed: ${object.getSpeed()}`,
                `Angle: ${angleDegrees}°`
            ];
        } else if (object instanceof Collectible) {
            return this.getCollectibleTooltip(object as Collectible, distance, angleDegrees);
        } else {
            return [
                'Type: Asteroid',
                `Speed: ${object.getSpeed()}`,
                `Angle: ${angleDegrees}°`,
                `Distance: ${Math.round(distance)}`
            ];
        }
    }
    
    /**
     * Get tooltip text for collectibles
     */
    private getCollectibleTooltip(collectible: Collectible, distance: number, angleDegrees: number): string[] {
        const baseTooltip = [
            `Type: ${this.getReadableTypeName(collectible)}`,
            `Value: ${collectible.getValue()}`,
            `Speed: ${collectible.getSpeed()}`,
            `Angle: ${angleDegrees}°`,
            `Distance: ${Math.round(distance)}`
        ];
        
        // Add specific details based on collectible type
        if (collectible instanceof Shipwreck) {
            baseTooltip.splice(2, 0, `Salvage: ${this.getReadableSalvageType(collectible.getSalvageType())}`);
        } else if (collectible instanceof EscapePod) {
            baseTooltip.splice(2, 0, `Survivors: ${collectible.getSurvivors()}`);
            
            if (collectible.isDistressSignalActive()) {
                baseTooltip.splice(3, 0, 'Distress Signal: Active');
            }
        }
        
        return baseTooltip;
    }
    
    /**
     * Convert collectible type to readable text
     */
    private getReadableTypeName(collectible: Collectible): string {
        if (collectible instanceof Shipwreck) {
            return 'Ship Wreck';
        } else if (collectible instanceof EscapePod) {
            return 'Escape Pod';
        } else {
            return 'Collectible';
        }
    }
    
    /**
     * Convert salvage type to readable text
     */
    private getReadableSalvageType(type: SalvageType): string {
        switch (type) {
            case SalvageType.FUEL:
                return 'Fuel';
            case SalvageType.WEAPONS:
                return 'Weapons';
            case SalvageType.TECH:
                return 'Technology';
            case SalvageType.GENERIC:
            default:
                return 'Generic';
        }
    }
} 