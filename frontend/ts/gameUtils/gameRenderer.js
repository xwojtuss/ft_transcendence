import { drawBackground, drawOutline, drawDottedLine, drawPongText, drawScore } from "./drawBoard.js";
export class GameRenderer {
    constructor(canvas, ctx) {
        this.FIELD_WIDTH = 150;
        this.FIELD_HEIGHT = 70;
        this.canvas = canvas;
        this.ctx = ctx;
    }
    setFieldDimensions(width, height) {
        this.FIELD_WIDTH = width;
        this.FIELD_HEIGHT = height;
    }
    scaleX(value) {
        return (value / this.FIELD_WIDTH) * this.canvas.width;
    }
    scaleY(value) {
        return (value / this.FIELD_HEIGHT) * this.canvas.height;
    }
    drawPlayer(player) {
        this.ctx.fillStyle = "gray";
        this.ctx.fillRect(this.scaleX(player.x), this.scaleY(player.y), this.scaleX(player.width), this.scaleY(player.height));
    }
    drawBall(ball) {
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.scaleX(ball.x), this.scaleY(ball.y), this.scaleX(ball.size), this.scaleY(ball.size));
    }
    drawGameMessages(gameState) {
        if (gameState.gameEnded && gameState.winner) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "30px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText(`Player ${gameState.winner} Won!`, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = "16px Arial";
            this.ctx.fillText("Press SPACE to play again", this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
        else if (!gameState.gameStarted && !gameState.gameInitialized) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "20px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Press SPACE to start", this.canvas.width / 2, this.canvas.height / 2 + 50);
        }
    }
    render(gameState) {
        // Draw background and static elements
        drawBackground();
        drawOutline();
        drawDottedLine();
        drawPongText();
        if (!(gameState === null || gameState === void 0 ? void 0 : gameState.players) || !(gameState === null || gameState === void 0 ? void 0 : gameState.ball))
            return;
        // Draw players
        if (gameState.players[1])
            this.drawPlayer(gameState.players[1]);
        if (gameState.players[2])
            this.drawPlayer(gameState.players[2]);
        // Draw ball
        this.drawBall(gameState.ball);
        // Draw score
        if (gameState.players[1] && gameState.players[2]) {
            drawScore(this.ctx, gameState.players[1].score, gameState.players[2].score);
        }
        // Draw game messages
        this.drawGameMessages(gameState);
    }
}
