const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

if (!ctx) {
	throw new Error("Failed to get canvas 2D context");
}

function resizeCanvas() {
	canvas.width = window.innerWidth * 0.9;
	canvas.height = window.innerHeight * 0.9;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function drawBackground() {
	if (!ctx) {
		console.error("Canvas context is not available");
		return;
	}
	ctx.fillStyle = "#0000ff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function gameLoop() {
	drawBackground();
	// requestAnimationFrame(gameLoop);
}
