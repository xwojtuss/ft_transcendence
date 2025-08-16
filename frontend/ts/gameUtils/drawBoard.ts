let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let maxHeight: number;

// Initialize the canvas and its context
export function initCanvas(): boolean {
	if (window.location.pathname === '/' || window.location.pathname === '/home') {
		canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
		if (!canvas) {
			throw new Error("Failed to get canvas element");
		}

		ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get canvas 2D context");
		}

		maxHeight = window.innerHeight * 0.8;
		resizeCanvas();
		return true;
	}
	return false;
}

function calculateCanvasSize(maxHeight: number) {
	if (!canvas || !ctx) {
		console.error("Canvas or context is not initialized");
		return { width: 0, height: 0 };
	}

	const aspectRatio = 16 / 9;

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

// Sets canvas size and border - dynamically changes both size and border
export function resizeCanvas() {
	if (!canvas || !ctx) {
		console.error("Canvas or context is not initialized");
		return;
	}

	const { width, height } = calculateCanvasSize(maxHeight);
	
	canvas.width = width;
	canvas.height = height;
	if (height > maxHeight) {
		canvas.height = maxHeight;
	}

	const borderWidth = Math.round(window.innerWidth * 0.02);
	canvas.style.border = `${borderWidth}px solid #121212`;
	canvas.style.boxSizing = "border-box";
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

// Dynamically get line width based on window size
export function getDynamicLineWidth() {
	const minLineWidth = 2;
	const maxLineWidth = 15;
	const relativeWidth = window.innerWidth / 1920;

	let lineWidth = Math.max(minLineWidth, Math.min(maxLineWidth * relativeWidth));
	if (lineWidth < minLineWidth) lineWidth = minLineWidth;
	if (lineWidth > maxLineWidth) lineWidth = maxLineWidth;

	return lineWidth;
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

// Sets dynamic font size based on window size
function getDynamicFontSize() {
	const minFontSize = 2;
	const maxFontSize = 20;
	const relativeWidth = window.innerWidth / 1920;

	let fontSize = Math.max(minFontSize, Math.min(maxFontSize * relativeWidth));
	if (fontSize < minFontSize) fontSize = minFontSize;
	if (fontSize > maxFontSize) fontSize = maxFontSize;

	return fontSize;
}

// Draw PONG text on left and right wall
export function drawPongText() {
	if (!canvas || !ctx) {
		console.error("Canvas context is not available");
		return;
	}

	const fontSize = getDynamicFontSize();
	ctx.fillStyle = "white";
	ctx.font = `${fontSize}px Arial`;

	// Top left
	ctx.save();
	ctx.translate(canvas.width * 0.005, canvas.height * 0.015);
	ctx.rotate(Math.PI / 2);
	ctx.textBaseline = "top";
	ctx.textAlign = "left";
	ctx.fillText("PONG", 0, -fontSize);
	ctx.restore();

	// Bottom right
	ctx.save();
	ctx.translate(canvas.width, canvas.height - fontSize * 3.5);
	ctx.rotate(-Math.PI / 2);
	ctx.textBaseline = "bottom";
	ctx.textAlign = "right";
	ctx.fillText("PONG", 0, -fontSize / 2);
	ctx.restore();
}

export function drawScore(ctx: CanvasRenderingContext2D, player1Score: number, player2Score: number) {
	if (!canvas || !ctx) {
		console.error("Canvas context is not available");
		return;
	}

	const fontSize = getDynamicFontSize() * 4;
	ctx.fillStyle = "white";
	ctx.strokeStyle = "black";
	ctx.lineWidth = getDynamicLineWidth() / 4;
	ctx.font = `${fontSize}px Tektur`;

	// Draw Player 1 Score
	ctx.save();
	ctx.translate(canvas.width * 0.45, canvas.height * 0.05);
	ctx.textBaseline = "top";
	ctx.textAlign = "left";
	ctx.strokeText(`${player1Score}`, 0, 0);
	ctx.fillText(`${player1Score}`, 0, 0);
	ctx.restore();

	// Draw :
	ctx.save();
	ctx.font = `bold ${fontSize * 0.8}px Tektur`;
	ctx.translate(canvas.width * 0.5, canvas.height * 0.05);
	ctx.textBaseline = "top";
	ctx.textAlign = "center";
	ctx.strokeText(`:`, 0, 0);
	ctx.fillText(`:`, 0, 0);
	ctx.restore();

	// Draw Player 2 Score
	ctx.save();
	ctx.translate(canvas.width * 0.55, canvas.height * 0.05);
	ctx.textBaseline = "top";
	ctx.textAlign = "right";
	ctx.strokeText(`${player2Score}`, 0, 0);
	ctx.fillText(`${player2Score}`, 0, 0);
	ctx.restore();
}