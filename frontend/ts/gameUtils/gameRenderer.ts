import { drawBackground, drawOutline, drawDottedLine, drawPongText, drawScore } from "./drawBoard.js";

// ^^^^^ TRDM ^^^^^ 
// helper to compute a readable name font based on canvas height
function nameFontPx(canvas: HTMLCanvasElement): number {
    return Math.max(12, Math.floor(canvas.height * 0.05)); // 5% of height, min 12px
}  

interface PlayerState {
    x: number;
    y: number;
    width: number;
    height: number;
    score: number;
}

interface BallState {
    x: number;
    y: number;
    size: number;
}

interface GameState {
    players: { [key: number]: PlayerState };
    ball: BallState;
    gameStarted: boolean;
    gameInitialized: boolean;
    gameEnded: boolean;
    winner: number | null;
}

export class GameRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private FIELD_WIDTH: number = 150;
    private FIELD_HEIGHT: number = 70;

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    setFieldDimensions(width: number, height: number) {
        this.FIELD_WIDTH = width;
        this.FIELD_HEIGHT = height;
    }

    private scaleX(value: number): number {
        return (value / this.FIELD_WIDTH) * this.canvas.width;
    }

    private scaleY(value: number): number {
        return (value / this.FIELD_HEIGHT) * this.canvas.height;
    }

    private drawPlayer(player: PlayerState) {
        this.ctx.fillStyle = "gray";
        this.ctx.fillRect(
            this.scaleX(player.x),
            this.scaleY(player.y),
            this.scaleX(player.width),
            this.scaleY(player.height)
        );
    }

    private drawBall(ball: BallState) {
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(
            this.scaleX(ball.x),
            this.scaleY(ball.y),
            this.scaleX(ball.size),
            this.scaleY(ball.size)
        );
    }

    private drawGameMessages(gameState: GameState) {
        if (gameState.gameEnded && gameState.winner) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "30px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText(`Player ${gameState.winner} Won!`, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = "16px Arial";
            this.ctx.fillText("Press SPACE to play again", this.canvas.width / 2, this.canvas.height / 2 + 40);
        } else if (!gameState.gameStarted && !gameState.gameInitialized) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "20px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Press SPACE to start", this.canvas.width / 2, this.canvas.height / 2 + 50);
        }
    }

    // draw player names at top-left and top-right
    private drawPlayerNames() {
        const name1 = (window as any).player1Name as string | undefined;
        const name2 = (window as any).player2Name as string | undefined;

        if (!name1 && !name2) return;

        this.ctx.fillStyle = "white";
        this.ctx.font = `${nameFontPx(this.canvas)}px Arial`;
        this.ctx.textBaseline = "top";

        if (name1) {
            this.ctx.textAlign = "left";
            this.ctx.fillText(name1, 50, 50);
        }
        if (name2) {
            this.ctx.textAlign = "right";
            this.ctx.fillText(name2, this.canvas.width - 50, 50);
        }
    }

    render(gameState: GameState | null) {
        // Draw background and static elements
        drawBackground();
        drawOutline();
        drawDottedLine();
        drawPongText();

        // ^^^^^ TRDM ^^^^^ draw player names at top-left and top-right
        this.drawPlayerNames();

        if (!gameState?.players || !gameState?.ball) return;

        // Draw players
        if (gameState.players[1]) this.drawPlayer(gameState.players[1]);
        if (gameState.players[2]) this.drawPlayer(gameState.players[2]);

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