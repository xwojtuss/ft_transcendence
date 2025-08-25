import { initCanvas, resizeCanvas, setGameDimensions } from "./gameUtils/drawBoard.js";
import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/gameRenderer.js";

export function initGameIfHome() {
    if (window.location.pathname !== '/' && window.location.pathname !== '/home') {
        return;
    }

    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");

    if (!canvas || !ctx) {
        throw new Error("Failed to get canvas");
    }

    initCanvas();

    let gameState: any = null;
    const renderer = new GameRenderer(canvas, ctx);

    // Setup WebSocket
    const gameWs = new GameWebSocket(
        `ws://localhost:3000/ws/localGame`,
        (config) => {
            setGameDimensions(config.FIELD_WIDTH, config.FIELD_HEIGHT);
            renderer.setFieldDimensions(config.FIELD_WIDTH, config.FIELD_HEIGHT);
            console.log("Game dimensions set:", config.FIELD_WIDTH, config.FIELD_HEIGHT);
        },
        (state) => {
            gameState = state;
        }
    );

    // Setup input handling
    new InputHandler(gameWs);

    // Game loop
    function gameLoop() {
        renderer.render(gameState);
        requestAnimationFrame(gameLoop);
    }

    gameLoop();

    // Handle resize
    const handleResize = () => resizeCanvas();
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);
}
