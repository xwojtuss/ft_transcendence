import { initCanvas, resizeCanvas, drawBackground, drawOutline, drawDottedLine, drawPongText, getDynamicLineWidth } from "./gameUtils/drawBoard.js";
import { Player, dynamicallyAdjustPlayer } from "./gameUtils/player.js";

export function initGameIfHome() {
	if (window.location.pathname === '/' || window.location.pathname === '/home') {
		const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
		const ctx = canvas.getContext("2d");

		if (!canvas || !ctx) {
			throw new Error("Failed to get canvas");
		}

		initCanvas();

		const player1 = new Player(canvas);
		const player2 = new Player(canvas);

		player1.align(getDynamicLineWidth() / 2);
		player2.align(canvas.width - player2.width - getDynamicLineWidth() / 2);

		function gameLoop() {
			drawBackground();
			drawOutline();
			drawDottedLine();
			drawPongText();

			if (!ctx) {
				throw new Error("Failed to get canvas context");
			}
			player1.draw(ctx);
			player2.draw(ctx);

			requestAnimationFrame(gameLoop);
		}
		gameLoop();

		window.addEventListener("resize", () => {
			resizeCanvas();
			
			dynamicallyAdjustPlayer(player1);
			dynamicallyAdjustPlayer(player2);
			player1.align(getDynamicLineWidth() / 2);
			player2.align(canvas.width - player2.width - getDynamicLineWidth() / 2);
			
			gameLoop();
		});
	}
}