class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private shipAngle: number; // in radians
    private shipX: number;
    private shipY: number;
    private shipSpeed: number;
    private speedElement: HTMLElement;
    private coordinatesElement: HTMLElement;
    private lastTime: number;
    private dots: { x: number; y: number }[];

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.clickCounter = 0;
        this.clickCounterElement = document.getElementById('clickCounter')!;
        this.shipAngle = 0; // facing right
        this.shipX = 0; // start at (0, 0)
        this.shipY = 0; // start at (0, 0)
        this.shipSpeed = 200; // increased speed
        this.speedElement = document.getElementById('speed')!;
        this.coordinatesElement = document.getElementById('coordinates')!;
        this.lastTime = performance.now();
        this.dots = [
            { x: 100, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: -80 }
        ];

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
        this.speedElement.textContent = this.shipSpeed.toString();
        this.coordinatesElement.textContent = `(${Math.round(this.shipX)}, ${Math.round(this.shipY)})`;
    }

    private drawRadar(): void {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY);

        // Draw rings
        for (let radius = maxRadius / 4; radius <= maxRadius; radius += maxRadius / 4) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#4caf50';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw lines
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + maxRadius * Math.cos(angle), centerY + maxRadius * Math.sin(angle));
            ctx.strokeStyle = '#4caf50';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
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

    private drawDots(): void {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.dots.forEach(dot => {
            const dotScreenX = centerX + dot.x - this.shipX;
            const dotScreenY = centerY + dot.y - this.shipY;
            ctx.beginPath();
            ctx.arc(dotScreenX, dotScreenY, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ff5722'; // orange dot
            ctx.fill();
        });
    }

    private gameLoop(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a dark mode background
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw radar
        this.drawRadar();

        // Update ship position based on speed and angle
        const speedInPointsPerSecond = 10;
        const speedInPointsPerFrame = speedInPointsPerSecond * deltaTime;
        this.shipX += speedInPointsPerFrame * Math.cos(this.shipAngle);
        this.shipY += speedInPointsPerFrame * Math.sin(this.shipAngle);

        // Draw the spaceship
        this.drawSpaceship();

        // Draw the dots
        this.drawDots();

        // Update HUD
        this.updateHUD();

        // Request the next frame
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    new Game();
}); 