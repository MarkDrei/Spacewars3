class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private shipAngle: number; // in radians

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.clickCounter = 0;
        this.clickCounterElement = document.getElementById('clickCounter')!;
        this.shipAngle = 0; // facing right

        this.initializeEventListeners();
        this.gameLoop();
    }

    private initializeEventListeners(): void {
        this.canvas.addEventListener('click', (event) => {
            this.clickCounter++;
            this.updateHUD();
            // Calculate angle from center to click
            const rect = this.canvas.getBoundingClientRect();
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const dx = mouseX - centerX;
            const dy = mouseY - centerY;
            this.shipAngle = Math.atan2(dy, dx);
        });
    }

    private updateHUD(): void {
        this.clickCounterElement.textContent = this.clickCounter.toString();
    }

    private drawSpaceship(): void {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.shipAngle);
        // Draw a simple triangle spaceship
        ctx.beginPath();
        ctx.moveTo(30, 0);    // nose
        ctx.lineTo(-15, 12);  // left wing
        ctx.lineTo(-10, 0);   // tail
        ctx.lineTo(-15, -12); // right wing
        ctx.closePath();
        ctx.fillStyle = '#4caf50'; // greenish fill
        ctx.fill();
        ctx.strokeStyle = '#2e7d32'; // darker green stroke
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    private gameLoop(): void {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a dark mode background
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the spaceship
        this.drawSpaceship();

        // Request the next frame
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    new Game();
}); 