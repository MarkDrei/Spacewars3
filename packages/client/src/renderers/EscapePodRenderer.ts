import { CollectibleRenderer } from './CollectibleRenderer';
import { Collectible } from '../Collectible';
import { EscapePod } from '../EscapePod';

/**
 * Renderer for EscapePod collectibles
 */
export class EscapePodRenderer extends CollectibleRenderer {
    private escapePodImage: HTMLImageElement;

    constructor() {
        super();
        this.escapePodImage = new Image();
        this.escapePodImage.src = 'resources/ai_gen/escape_pod.png';
    }

    /**
     * Draw the escape pod shape
     */
    protected drawCollectibleShape(ctx: CanvasRenderingContext2D, collectible: Collectible): void {
        if (!(collectible instanceof EscapePod)) return;
        
        const escapePod = collectible as EscapePod;
        
        ctx.save();
        ctx.rotate(Math.PI / 2);

        if (this.escapePodImage.complete && this.escapePodImage.naturalHeight !== 0) {
            const aspectRatio = this.escapePodImage.naturalWidth / this.escapePodImage.naturalHeight;
            const height = 45;
            const width = height * aspectRatio;
            ctx.drawImage(this.escapePodImage, -width / 2, -height / 2, width, height);
        }

        if (escapePod.getSpeed() > 0) {
            const time = Date.now();
            const flicker = Math.abs(Math.sin(time / 500)); // Flicker effect for the flame
            const flameLength = 20 + flicker * 10;
            const flameWidth = 10 + flicker * 4;
            const podBottomY = 45 / 2;

            ctx.beginPath();
            ctx.moveTo(-flameWidth / 2, podBottomY - 5);
            ctx.lineTo(flameWidth / 2, podBottomY - 5);
            ctx.lineTo(0, podBottomY + flameLength);
            ctx.closePath();

            const gradient = ctx.createLinearGradient(0, podBottomY, 0, podBottomY + flameLength);
            gradient.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
            gradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.7)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.restore();
    }
} 