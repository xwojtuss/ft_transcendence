import { calculateCanvasSize, getDynamicLineWidth } from "./drawBoard.js";

// calculate player dimensions
function calculatePlayerDimensions(canvas: HTMLCanvasElement): { width: number; height: number } {
	const height = canvas.height * 0.2;
	const width = height * 0.3;

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
export function dynamicallyAdjustPlayer(player: Player) {

	const newPos = alignMiddle(player.canvas);
	const dims = calculatePlayerDimensions(player.canvas);
			
	player.width = dims.width;
	player.height = dims.height;
	player.position.x = newPos.position.x;
	player.position.y = newPos.position.y;

}

type Position = {
	x: number;
	y: number;
};

export class Player {
	score: number;
	position: Position;
	width: number;
	height: number;
	canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.score = 0;
		this.canvas = canvas;
		this.position = alignMiddle(this.canvas).position;
		this.width = calculatePlayerDimensions(this.canvas).width;
		this.height = calculatePlayerDimensions(this.canvas).height;
	}

	move(y: number) {
		this.position.y += y;
	}

	align(x: number) {
		this.position.x = x;
	}

	addPoint() {
		this.score++;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "gray";
		ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
	}

	getScore() {
		return this.score;
	}
}
