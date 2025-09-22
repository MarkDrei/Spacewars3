import type { InterceptionLines } from '@shared/types/gameTypes';

export class InterceptionLineRenderer {
  constructor(private ctx: CanvasRenderingContext2D) {}
  
  drawInterceptionLines(
    interceptionLines: InterceptionLines,
    centerX: number,
    centerY: number, 
    shipX: number,
    shipY: number
  ): void {
    const opacity = this.calculateOpacity(interceptionLines);
    if (opacity <= 0) return; // Don't render if fully faded
    
    // Convert world coordinates to screen coordinates
    const shipScreenX = centerX + (interceptionLines.shipToInterceptX - shipX);
    const shipScreenY = centerY + (interceptionLines.shipToInterceptY - shipY);
    const targetScreenX = centerX + (interceptionLines.targetToInterceptX - shipX);
    const targetScreenY = centerY + (interceptionLines.targetToInterceptY - shipY);
    const interceptScreenX = centerX + (interceptionLines.interceptX - shipX);
    const interceptScreenY = centerY + (interceptionLines.interceptY - shipY);
    
    // Draw ship-to-intercept line (green-blue)
    this.drawShipLine(shipScreenX, shipScreenY, interceptScreenX, interceptScreenY, opacity);
    
    // Draw target-to-intercept line (orange-red)
    this.drawTargetLine(targetScreenX, targetScreenY, interceptScreenX, interceptScreenY, opacity);
    
    // Draw interception point indicator
    this.drawInterceptIndicator(interceptScreenX, interceptScreenY, opacity);
    
    // Draw time-to-intercept display to the top right of ship (center of canvas)
    this.drawTimeToIntercept(centerX, centerY, interceptionLines.timeToIntercept, opacity);
  }
  
  private calculateOpacity(interceptionLines: InterceptionLines): number {
    const elapsed = Date.now() - interceptionLines.createdAt;
    const progress = elapsed / interceptionLines.duration;
    
    // Linear fade from 1.0 to 0.0
    return Math.max(0, 1.0 - progress);
  }
  
  private drawShipLine(startX: number, startY: number, endX: number, endY: number, opacity: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(76, 175, 255, ${opacity * 0.8})`; // Blue-green for ship path
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.setLineDash([5, 3]); // Dashed line for ship
    
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();
    this.ctx.restore();
  }
  
  private drawTargetLine(startX: number, startY: number, endX: number, endY: number, opacity: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(255, 140, 70, ${opacity * 0.8})`; // Orange-red for target path
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.setLineDash([3, 5]); // Different dash pattern for target
    
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();
    this.ctx.restore();
  }
  
  private drawInterceptIndicator(x: number, y: number, opacity: number): void {
    this.ctx.save();
    this.ctx.fillStyle = `rgba(255, 255, 0, ${opacity * 0.9})`; // Yellow for intercept point
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`; // White outline
    this.ctx.lineWidth = 1;
    
    // Draw a small diamond shape at the intercept point
    const size = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x + size, y);
    this.ctx.lineTo(x, y + size);
    this.ctx.lineTo(x - size, y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }
  
  private drawTimeToIntercept(centerX: number, centerY: number, timeToIntercept: number, opacity: number): void {
    this.ctx.save();
    
    // Format time as MM:SS
    const minutes = Math.floor(timeToIntercept / 60);
    const seconds = Math.floor(timeToIntercept % 60);
    const timeText = `-${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Position to the top right of the ship (center of canvas)
    const textX = centerX + 30; // 30 pixels to the right
    const textY = centerY - 20; // 20 pixels above
    
    // Set text styling
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    
    // Draw text with subtle shadow for better readability
    this.ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.5})`;
    this.ctx.fillText(timeText, textX + 1, textY + 1);
    
    // Main text
    this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    this.ctx.fillText(timeText, textX, textY);
    
    this.ctx.restore();
  }
}