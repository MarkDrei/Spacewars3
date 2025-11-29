import { World } from '../game/World';
import type { TargetingLine } from '@shared/types/gameTypes';
import { debugState } from '../debug/debugState';

export class TargetingLineRenderer {
  constructor(private ctx: CanvasRenderingContext2D) {}
  
  drawTargetingLine(
    targetingLine: TargetingLine,
    centerX: number,
    centerY: number, 
    shipX: number,
    shipY: number
  ): void {
    if (!debugState.debugDrawingsEnabled) return;

    const opacity = this.calculateOpacity(targetingLine);
    if (opacity <= 0) return; // Don't render if fully faded
    
    // Convert world coordinates to screen coordinates
    const startScreenX = centerX + (targetingLine.startX - shipX);
    const startScreenY = centerY + (targetingLine.startY - shipY);
    const targetScreenX = centerX + (targetingLine.targetX - shipX);
    const targetScreenY = centerY + (targetingLine.targetY - shipY);
    
    // Draw the main line
    this.drawLine(startScreenX, startScreenY, targetScreenX, targetScreenY, opacity);
    
    // Draw target indicator
    this.drawTargetIndicator(targetScreenX, targetScreenY, opacity);
    
    // Handle toroidal wrapping - draw wrapped versions if they would be visible
    this.drawWrappedLines(targetingLine, centerX, centerY, shipX, shipY, opacity);
  }
  
  private calculateOpacity(targetingLine: TargetingLine): number {
    const elapsed = Date.now() - targetingLine.createdAt;
    const progress = elapsed / targetingLine.duration;
    
    // Linear fade from 1.0 to 0.0
    return Math.max(0, 1.0 - progress);
  }
  
  private drawLine(startX: number, startY: number, endX: number, endY: number, opacity: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(0, 255, 255, ${opacity * 0.8})`; // Cyan with opacity
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();
    
    this.ctx.restore();
  }
  
  private drawTargetIndicator(x: number, y: number, opacity: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(0, 255, 255, ${opacity * 0.9})`; // Slightly more opaque
    this.ctx.lineWidth = 2;
    
    // Draw a small crosshair
    const size = 8;
    this.ctx.beginPath();
    // Horizontal line
    this.ctx.moveTo(x - size, y);
    this.ctx.lineTo(x + size, y);
    // Vertical line
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x, y + size);
    this.ctx.stroke();
    
    this.ctx.restore();
  }
  
  private drawWrappedLines(
    targetingLine: TargetingLine,
    centerX: number,
    centerY: number,
    shipX: number,
    shipY: number,
    opacity: number
  ): void {
    const worldWidth = World.WIDTH;
    const worldHeight = World.HEIGHT;
    
    // Define offsets for wrapped positions
    const wrapOffsets = [
      { x: -worldWidth, y: 0 },             // Left
      { x: worldWidth, y: 0 },              // Right
      { x: 0, y: -worldHeight },            // Top
      { x: 0, y: worldHeight },             // Bottom
      { x: -worldWidth, y: -worldHeight },  // Top-Left
      { x: worldWidth, y: -worldHeight },   // Top-Right
      { x: -worldWidth, y: worldHeight },   // Bottom-Left
      { x: worldWidth, y: worldHeight }     // Bottom-Right
    ];
    
    // Check each wrapped position
    wrapOffsets.forEach(offset => {
      // Calculate wrapped target position
      const wrappedTargetX = targetingLine.targetX + offset.x;
      const wrappedTargetY = targetingLine.targetY + offset.y;
      
      // Convert to screen coordinates
      const wrappedScreenX = centerX + (wrappedTargetX - shipX);
      const wrappedScreenY = centerY + (wrappedTargetY - shipY);
      
      // Only draw if the wrapped target would be visible on screen
      if (this.isPositionVisible(wrappedScreenX, wrappedScreenY)) {
        const startScreenX = centerX + (targetingLine.startX - shipX);
        const startScreenY = centerY + (targetingLine.startY - shipY);
        
        this.drawLine(startScreenX, startScreenY, wrappedScreenX, wrappedScreenY, opacity);
        this.drawTargetIndicator(wrappedScreenX, wrappedScreenY, opacity);
      }
    });
  }
  
  private isPositionVisible(screenX: number, screenY: number): boolean {
    const margin = 50; // Small margin to account for indicator size
    return (
      screenX > -margin && 
      screenX < this.ctx.canvas.width + margin && 
      screenY > -margin && 
      screenY < this.ctx.canvas.height + margin
    );
  }
}