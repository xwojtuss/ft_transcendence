// Dynamically calculate ball's size
function getDynamicBallSize(canvas: HTMLCanvasElement): number {
	const height = (canvas.height * 0.2);
	const width = height / 6;
	return width;
}

export function dynamicallyAdjustBall(ball: Ball, oldCanvasWidth: number, oldCanvasHeight: number) {
	ball.size = getDynamicBallSize(ball.canvas);

	const scaleX = ball.canvas.width / oldCanvasWidth;
	const scaleY = ball.canvas.height / oldCanvasHeight;

	ball.position.x *= scaleX;
	ball.position.y *= scaleY;

	ball.position.x = Math.min(Math.max(ball.position.x, 0), ball.canvas.width - ball.size);
	ball.position.y = Math.min(Math.max(ball.position.y, 0), ball.canvas.height - ball.size);
}

type Position = {
	x: number;
	y: number;
};

export class Ball {
	position: Position;
	size: number;
	canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.position = { x: canvas.width / 2, y: canvas.height / 2 };
		this.size = getDynamicBallSize(canvas);
		this.canvas = canvas;
	}

	move(x: number, y: number) {
		this.position.x += x;
		this.position.y += y;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "white";
		ctx.fillRect(this.position.x - this.size / 2, this.position.y - this.size / 2, this.size, this.size);
	}

}