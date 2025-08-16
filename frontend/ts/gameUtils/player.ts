// calculate player dimensions
function calculatePlayerDimensions(canvas: HTMLCanvasElement): { width: number; height: number } {
	const height = canvas.height * 0.2;
	const width = canvas.width * 0.03;

	return { width, height };
}

// Align player on the middle of the canvas
function alignMiddle(canvas: HTMLCanvasElement): { position: Position } {
	const canvasWidth = canvas.width;
	const canvasHeight = canvas.height;

	const playerDimensions = calculatePlayerDimensions(canvas);
	const x = (canvasWidth - playerDimensions.width) / 2;
	const y = (canvasHeight - playerDimensions.height) / 2;

	return { position: { x, y } };
}

// Set player dimensions and positions dynamically to where they were
export function dynamicallyAdjustPlayer(player: Player, oldCanvasHeight: number) {

	const dims = calculatePlayerDimensions(player.canvas);
			
	player.width = dims.width;
	player.height = dims.height;

	const scaleY = player.canvas.height / oldCanvasHeight;
	player.position.y *= scaleY;

	if (player.position.y < 0) {
		player.position.y = 0;
	} else if (player.position.y + player.height > player.canvas.height) {
		player.position.y = player.canvas.height - player.height;
	}

}

type Position = {
	x: number;
	y: number;
};

export class Player {
	#score = 0;
	#paddleSpeed = 5;
	position: Position;
	width: number;
	height: number;
	canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.position = alignMiddle(this.canvas).position;
		this.width = calculatePlayerDimensions(this.canvas).width;
		this.height = calculatePlayerDimensions(this.canvas).height;
	}

	move(deltaY: number) {
		this.position.y += deltaY * this.#paddleSpeed;

		// Keep player within canvas bounds
		if (this.position.y < 0) {
			this.position.y = 0;
		} else if (this.position.y + this.height > this.canvas.height) {
			this.position.y = this.canvas.height - this.height;
		}
	}

	align(x: number) {
		this.position.x = x;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "gray";
		ctx.fillRect(this.position.x - this.width / 2, this.position.y, this.width, this.height);
	}
	
	updateScore(newScore: number) {
		this.#score = newScore;
	}

	getScore() {
		return this.#score;
	}
}
