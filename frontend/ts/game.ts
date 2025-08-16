import { initCanvas, resizeCanvas, drawBackground, drawOutline, drawDottedLine, drawPongText, getDynamicLineWidth, drawScore } from "./gameUtils/drawBoard.js";
import { Player, dynamicallyAdjustPlayer } from "./gameUtils/player.js";
import { Ball, dynamicallyAdjustBall } from "./gameUtils/ball.js";

export function initGameIfHome() {
	if (window.location.pathname === '/' || window.location.pathname === '/home') {
		const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
		const ctx = canvas.getContext("2d");

		if (!canvas || !ctx) {
			throw new Error("Failed to get canvas");
		}

		initCanvas();

		const ball = new Ball(canvas);

		const player1 = new Player(canvas);
		const player2 = new Player(canvas);

		// Align ich na podstawie ich szerokosci, na wiekszym ekranie sa troche bardziej przesunieci w lewo
		player1.align(getDynamicLineWidth() * 2.5);
		player2.align(canvas.width - getDynamicLineWidth() * 2.5);

		function gameLoop() {
			drawBackground();
			drawOutline();
			drawDottedLine();
			drawPongText();

			if (!ctx) {
				throw new Error("Failed to get canvas context");
			}

			ball.draw(ctx);
			player1.draw(ctx);
			player2.draw(ctx);
			drawScore(ctx, player1.getScore(), player2.getScore());

			requestAnimationFrame(gameLoop);
		}
		gameLoop();

		window.addEventListener("resize", () => {
			const oldWidth = canvas.width;
			const oldHeight = canvas.height;

			resizeCanvas();
			
			dynamicallyAdjustPlayer(player1, oldHeight);
			dynamicallyAdjustPlayer(player2, oldHeight);
			player1.align(getDynamicLineWidth() * 2.5);
			player2.align(canvas.width - getDynamicLineWidth() * 2.5);

			dynamicallyAdjustBall(ball, oldWidth, oldHeight);

			gameLoop();
		});
	}
}