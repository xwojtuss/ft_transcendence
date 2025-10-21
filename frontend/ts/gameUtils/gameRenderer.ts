import { drawBackground, drawOutline, drawDottedLine, drawPongText, drawScore } from "./drawBoard.js";

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
    winnerNick?: string;
}

export class GameRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private FIELD_WIDTH: number = 150;
    private FIELD_HEIGHT: number = 70;
    private overlayMessage: string | null = null; // <-- dodane pole

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.overlayMessage = null; // <-- dodane pole
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

    private drawRemoteGameMessages(gameState: GameState) {
        if (gameState.gameEnded && gameState.winner) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "30px Arial";
            this.ctx.textAlign = "center";
            if (!gameState.winnerNick) {
                if (gameState.winner === 1) {
                    gameState.winnerNick = "Left Player";
                }
                else if (gameState.winner === 2) {
                    gameState.winnerNick = "Right Player";
                }
            }
            this.ctx.fillText(`${gameState.winnerNick} Won!`, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = "16px Arial";
            this.ctx.fillText("Waiting for new game...", this.canvas.width / 2, this.canvas.height / 2 + 40);
        } else if (!gameState.gameStarted && !gameState.gameInitialized) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "20px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Game is starting...", this.canvas.width / 2, this.canvas.height / 2 + 50);
        }
    }

    // dodaj metodę ustawiającą komunikat nakładki
    setOverlayMessage(message: string | null) {
        this.overlayMessage = message;
    }

    clearOverlayMessage() {
        this.overlayMessage = null;
    }

    render(gameState: GameState | null, mode: "local" | "remote") {
        // always draw background/static elements so overlay can be shown even without a gameState
        drawBackground();
        drawOutline();
        drawDottedLine();
        drawPongText();

        // If we have a valid gameState, draw it
        if (gameState?.players && gameState?.ball) {
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
            if (mode === "local") {
                this.drawGameMessages(gameState);
            } else if (mode === "remote") {
                this.drawRemoteGameMessages(gameState);
            }
        }

        // always draw overlay if it's set
        if (this.overlayMessage) {
            try {
                const ctx = this.ctx;
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

                ctx.fillStyle = '#fff';
                const fontSize = Math.max(16, Math.floor(this.canvas.width / 30));
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const lines = String(this.overlayMessage).split('\n');
                const startY = this.canvas.height / 2 - ((lines.length - 1) * fontSize) / 2;
                lines.forEach((line, i) => {
                    ctx.fillText(line, this.canvas.width / 2, startY + i * fontSize);
                });

                ctx.restore();
            } catch (e) { /* ignore */ }
        }
    }
}