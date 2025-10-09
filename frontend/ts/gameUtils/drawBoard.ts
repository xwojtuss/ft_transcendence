let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let maxHeight: number;

// Game field dimensions - will be set by WebSocket
let FIELD_WIDTH = 100;
let FIELD_HEIGHT = 70;

// Function to set dimensions from backend
export function setGameDimensions(width: number, height: number) {
    FIELD_WIDTH = width;
    FIELD_HEIGHT = height;
    // Recalculate canvas after receiving new dimensions
    if (canvas) {
        resizeCanvas();
    }
}

// Initialize the canvas and its context
export function initCanvas(): boolean {
    let canvasId: string | null = null;

    if (window.location.pathname === '/game/local') {
        canvasId = "local-game-canvas";
    } else if (window.location.pathname === '/game/online') {
        canvasId = "remote-game-canvas";
    } else {
        return false;
    }

    canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
        throw new Error(`Failed to get canvas element: ${canvasId}`);
    }

    ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Failed to get canvas 2D context");
    }

    maxHeight = window.innerHeight * 0.8;
    resizeCanvas();
    return true;
}

function calculateCanvasSize(maxHeight: number) {
    if (!canvas || !ctx) {
        console.error("Canvas or context is not initialized");
        return { width: 0, height: 0 };
    }

    // Use aspect ratio from backend
    const aspectRatio = FIELD_WIDTH / FIELD_HEIGHT;

    const availableWidth = window.innerWidth * 0.9;
    const availableHeight = window.innerHeight * 0.8;

    let width = availableWidth;
    let height = width / aspectRatio;

    if (height > availableHeight || height > maxHeight) {
        height = Math.min(availableHeight, maxHeight);
        width = height * aspectRatio;
    }

    return { width, height };
}

function getResponsiveBorderWidth(): number {
    const vw = window.innerWidth;
    
    if (vw < 640) return 4;
    if (vw < 768) return 6;
    if (vw < 1024) return 8;
    if (vw < 1280) return 10;
    if (vw < 1536) return 12;
    if (vw < 1920) return 14;
    if (vw < 2560) return 16;
    
    return 18;
}

// Sets canvas size and border - dynamically changes both size and border
export function resizeCanvas() {
    if (!canvas || !ctx) {
        console.error("Canvas or context is not initialized");
        return;
    }

    const { width, height } = calculateCanvasSize(maxHeight);
    
    canvas.width = width;
    canvas.height = Math.min(height, maxHeight);

    const borderWidth = getResponsiveBorderWidth();
    canvas.style.border = `${borderWidth}px solid #121212`;
    canvas.style.boxSizing = 'border-box';
}

// Draw the initial background of the canvas
export function drawBackground() {
	if (!canvas || !ctx) {
		console.error("Canvas context is not available");
		return;
	}
	ctx.fillStyle = "#3a3a3a";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Universal scaling function
function getScaledValue(baseValue: number, minValue: number, maxValue: number): number {
    const relativeWidth = window.innerWidth / 1920;
    const relativeHeight = window.innerHeight / 1080;
    const relativeScale = Math.min(relativeWidth, relativeHeight);
    
    const scaledValue = baseValue * relativeScale;
    return Math.max(minValue, Math.min(maxValue, scaledValue));
}

export function getDynamicLineWidth(): number {
    return getScaledValue(15, 2, 15);
}

function getDynamicFontSize(): number {
    return getScaledValue(20, 2, 20);
}

// Draw white outline around the canvas
export function drawOutline() {
	if (!canvas || !ctx) {
		console.error("Canvas context is not available");
		return;
	}

	const lineWidth = getDynamicLineWidth();

	ctx.strokeStyle = "white";
	ctx.lineWidth = lineWidth;
	ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

// Draw dotted line in the middle of the canvas - TOP-BOTTOM
export function drawDottedLine() {
	if (!canvas || !ctx) {
		console.error("Canvas context is not available");
		return;
	}

	const outlineWidth = getDynamicLineWidth();
	const dottedLineWidth = Math.max(1, outlineWidth / 3);

	ctx.strokeStyle = "white";
	ctx.lineWidth = dottedLineWidth / 2;

	const dashLength = 5 * dottedLineWidth;
	const spaceLength = 3 * dottedLineWidth;
	ctx.setLineDash([dashLength, spaceLength]);
	ctx.beginPath();
	ctx.moveTo(canvas.width / 2, 0);
	ctx.lineTo(canvas.width / 2, canvas.height);
	ctx.stroke();
	ctx.setLineDash([]);
}

// Draw PONG text on left and right wall
export function drawPongText() {
    if (!canvas || !ctx) return;

    const fontSize = getDynamicFontSize();
    const outlineWidth = getDynamicLineWidth();
    
    ctx.fillStyle = "white";
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = "top";

    // Top left corner - horizontal
    ctx.save();
    ctx.translate(fontSize * 0.5 + outlineWidth, fontSize * 0.5);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = "left";
    ctx.fillText("PONG", 0, 0);
    ctx.restore();

    // Bottom right corner - vertical upwards, shifted left before outline
    ctx.save();
    ctx.translate(canvas.width - fontSize * 0.5 - outlineWidth, canvas.height - fontSize * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "left";
    ctx.fillText("PONG", 0, 0);
    ctx.restore();
}

export function drawScore(ctx: CanvasRenderingContext2D, player1Score: number, player2Score: number) {
    if (!canvas || !ctx) return;

    const fontSize = getDynamicFontSize() * 4;
    ctx.font = `${fontSize}px Tektur`;
    ctx.textBaseline = "top";

    // Function to draw text with outline
    function drawTextWithOutline(text: string, x: number, y: number, align: CanvasTextAlign) {
        ctx.textAlign = align;

        ctx.strokeStyle = "black";
        ctx.lineWidth = fontSize * 0.05;
        ctx.strokeText(text, x, y);

        ctx.fillStyle = "white";
        ctx.fillText(text, x, y);
    }

    // Player 1 score
    drawTextWithOutline(`${player1Score}`, canvas.width * 0.48, canvas.height * 0.05, "right");

    // Colon
    drawTextWithOutline(":", canvas.width * 0.5, canvas.height * 0.05, "center");

    // Player 2 score
    drawTextWithOutline(`${player2Score}`, canvas.width * 0.52, canvas.height * 0.05, "left");
}

// One function to draw all background elements
export function drawGameBoard() {
    drawBackground();
    drawOutline();
    drawDottedLine();
    drawPongText();
}