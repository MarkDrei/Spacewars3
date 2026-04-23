import { Ship } from '../game/Ship';
import { SpaceObjectOld } from '../game/SpaceObject';
import { Collectible } from '../game/Collectible';
import { Shipwreck } from '../game/Shipwreck';
import { EscapePod } from '../game/EscapePod';
import { Starbase } from '../game/Starbase';
import { World } from '../game/World';
import { formatNumber } from '@/shared/numberFormat';

export class TooltipRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }

    private calculateDistanceToShip(object: SpaceObjectOld, ship: Ship): number {
        if (object === ship) return 0;
        
        const dx = object.getX() - ship.getX();
        const dy = object.getY() - ship.getY();
        return Math.sqrt(dx * dx + dy * dy);
    }

    private getClosestToroidalOffset(delta: number, worldSize: number): number {
        const candidates = [delta, delta - worldSize, delta + worldSize];
        return candidates.reduce((closest, candidate) => {
            return Math.abs(candidate) < Math.abs(closest) ? candidate : closest;
        });
    }

    private getTooltipAnchor(object: SpaceObjectOld, ship: Ship, worldScale: number, cssWidth: number, cssHeight: number) {
        if (object === ship) {
            return {
                screenX: cssWidth / 2,
                screenY: cssHeight / 2,
            };
        }

        const relativeX = this.getClosestToroidalOffset(object.getX() - ship.getX(), World.WIDTH);
        const relativeY = this.getClosestToroidalOffset(object.getY() - ship.getY(), World.HEIGHT);

        return {
            screenX: cssWidth / 2 + relativeX * worldScale,
            screenY: cssHeight / 2 + relativeY * worldScale,
        };
    }

    drawTooltip(spaceObjects: SpaceObjectOld[], ship: Ship, worldScale?: number): void {
        // Find the first hovered object
        const hoveredObject = spaceObjects.find(obj => obj.isHoveredState());
        
        if (!hoveredObject) return;
        
        // Draw the tooltip in CSS pixels so its size stays readable regardless of
        // device pixel ratio or gameplay zoom. The object anchor still follows the
        // zoomed world position, but the box dimensions and text stay constant.
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const effectiveScale = worldScale ?? 1;
        const cssWidth = this.canvas.width / dpr;
        const cssHeight = this.canvas.height / dpr;
        const { screenX, screenY } = this.getTooltipAnchor(hoveredObject, ship, effectiveScale, cssWidth, cssHeight);
        
        // Get object information
        const tooltipText = this.getTooltipTextForObject(hoveredObject, ship);
        
        // Draw tooltip background
        const paddingX = 24;
        const paddingY = 12;
        const lineHeight = 19;
        const tooltipWidth = 206;
        const tooltipHeight = tooltipText.length * lineHeight + paddingY * 2 + 14;
        
        // Position tooltip to avoid going off-screen
        const tooltipX = Math.max(8, Math.min(screenX + 28, cssWidth - tooltipWidth - 8));
        const tooltipY = Math.max(8, Math.min(screenY - tooltipHeight - 14, cssHeight - tooltipHeight - 8));

        this.ctx.save();
        this.ctx.scale(dpr, dpr);

        this.ctx.shadowColor = 'rgba(76, 175, 80, 0.22)';
        this.ctx.shadowBlur = 16;
        
        // Draw tooltip background
        this.ctx.fillStyle = 'rgba(6, 14, 10, 0.94)';
        this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.fillRect(tooltipX + 1, tooltipY + 1, tooltipWidth - 2, tooltipHeight - 2);
        
        // Draw tooltip border
        this.ctx.strokeStyle = 'rgba(112, 196, 120, 0.9)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

        this.ctx.fillStyle = 'rgba(129, 199, 132, 0.92)';
        this.ctx.fillRect(tooltipX + 12, tooltipY + 12, 4, tooltipHeight - 24);
        
        // Draw tooltip text
        this.ctx.fillStyle = '#e8f5e9';
        this.ctx.font = '600 13px Arial';
        this.ctx.textAlign = 'left';
        
        tooltipText.forEach((line, index) => {
            if (index === 0) {
                this.ctx.fillStyle = '#f5fff5';
                this.ctx.font = '700 14px Arial';
            } else {
                this.ctx.fillStyle = index === tooltipText.length - 1 && line.startsWith('Action:')
                    ? '#9ccc65'
                    : '#d7ead8';
                this.ctx.font = '500 12px Arial';
            }

            this.ctx.fillText(
                line, 
                tooltipX + paddingX,
                tooltipY + paddingY + 16 + index * lineHeight
            );
        });

        this.ctx.restore();
    }
    
    /**
     * Get tooltip text based on object type
     */
    private getTooltipTextForObject(object: SpaceObjectOld, ship: Ship): string[] {
        // Calculate common properties
        const distance = this.calculateDistanceToShip(object, ship);
        const angleDegrees = object.getAngleDegrees();
        const objectType = object.getType();
        
        // Check object type and create appropriate tooltip
        if (object === ship) {
            return [
                'Ship',
                `Speed: ${formatNumber(object.getSpeed())}`,
                `Angle: ${formatNumber(angleDegrees)}°`
            ];
        }

        if (object instanceof Starbase || objectType === 'starbase') {
            return [
                'Starbase',
                `Distance: ${formatNumber(distance)}`,
                'Action: tap again to dock',
            ];
        }

        if (object instanceof Ship || objectType === 'player_ship' || objectType === 'npc_ship') {
            const objectLevel = object.getLevel();
            const shipLines = [
                objectType === 'npc_ship' ? 'NPC Ship' : 'Enemy Ship',
                `Speed: ${formatNumber(object.getSpeed())}`,
                `Angle: ${formatNumber(angleDegrees)}°`,
                `Distance: ${formatNumber(distance)}`,
            ];

            if (typeof objectLevel === 'number') {
                shipLines.splice(1, 0, `Level: ${formatNumber(objectLevel)}`);
            }

            return shipLines;
        }

        if (objectType === 'asteroid') {
            return [
                'Asteroid',
                `Speed: ${formatNumber(object.getSpeed())}`,
                `Angle: ${formatNumber(angleDegrees)}°`,
                `Distance: ${formatNumber(distance)}`,
            ];
        }

        if (object instanceof Collectible) {
            return this.getCollectibleTooltip(object as Collectible, distance, angleDegrees);
        }

        return [
            'Space Object',
            `Speed: ${formatNumber(object.getSpeed())}`,
            `Angle: ${formatNumber(angleDegrees)}°`,
            `Distance: ${formatNumber(distance)}`
        ];
    }
    
    /**
     * Get tooltip text for collectibles
     */
    private getCollectibleTooltip(collectible: Collectible, distance: number, angleDegrees: number): string[] {
        const baseTooltip = [
            this.getReadableTypeName(collectible),
            `Speed: ${formatNumber(collectible.getSpeed())}`,
            `Angle: ${formatNumber(angleDegrees)}°`,
            `Distance: ${formatNumber(distance)}`
        ];
        
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
        } else if (collectible.getType() === 'asteroid') {
            return 'Asteroid';
        } else {
            return 'Collectible';
        }
    }
    
    /**
     * Convert salvage type to readable text
     */
} 