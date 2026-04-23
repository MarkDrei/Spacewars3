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
        const paddingX = 14;
        const paddingY = 10;
        const lineHeight = 16;
        const tooltipWidth = 160;
        const tooltipHeight = tooltipText.length * lineHeight + paddingY * 2 + 6;
        
        // Position tooltip to avoid going off-screen
        const tooltipX = Math.max(8, Math.min(screenX + 16, cssWidth - tooltipWidth - 8));
        const tooltipY = Math.max(8, Math.min(screenY - tooltipHeight - 10, cssHeight - tooltipHeight - 8));

        this.ctx.save();
        this.ctx.scale(dpr, dpr);

        // Tiny glow effect to the boundary
        this.ctx.shadowColor = 'rgba(76, 175, 80, 0.35)';
        this.ctx.shadowBlur = 4;
        
        // Main Background - semi-transparent deep black/green
        this.ctx.fillStyle = 'rgba(5, 10, 8, 0.92)';
        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 3);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;

        // Subtle gradient overlay for depth
        const gradient = this.ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 3);
        this.ctx.fill();
        
        // Border - thin and sharp with the green theme
        this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
        this.ctx.lineWidth = 0.8;
        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 3);
        this.ctx.stroke();

        // Accent indicator at the top
        this.ctx.fillStyle = '#4caf50';
        this.ctx.fillRect(tooltipX + tooltipWidth / 2 - 12, tooltipY, 24, 1.5);
        
        // Draw tooltip text
        this.ctx.font = '500 11px "Geist", "Arial", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        tooltipText.forEach((line, index) => {
            const isTitle = index === 0;
            const isAction = line.startsWith('Action:');

            if (isTitle) {
                this.ctx.fillStyle = '#4caf50'; // Green theme color for heading
                this.ctx.font = '700 12px "Geist", "Arial", sans-serif';
                this.ctx.fillText(
                    line.toUpperCase(), 
                    tooltipX + paddingX,
                    tooltipY + paddingY + index * lineHeight
                );
                
                // Separator line after title
                this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
                this.ctx.beginPath();
                this.ctx.moveTo(tooltipX + paddingX, tooltipY + paddingY + lineHeight + 2);
                this.ctx.lineTo(tooltipX + tooltipWidth - paddingX, tooltipY + paddingY + lineHeight + 2);
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = isAction ? '#81c784' : 'rgba(232, 245, 233, 0.75)';
                this.ctx.font = isAction ? '600 10px "Geist Mono", "Courier New", monospace' : '400 10px "Geist", "Arial", sans-serif';
                
                const yOffset = isTitle ? 0 : 6; // Extra padding after title
                this.ctx.fillText(
                    line, 
                    tooltipX + paddingX,
                    tooltipY + paddingY + index * lineHeight + yOffset
                );
            }
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