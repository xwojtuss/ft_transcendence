import { initCanvas, resizeCanvas, setGameDimensions } from "./gameUtils/drawBoard.js";
import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/gameRenderer.js";

let gameInstance: {
    ws: GameWebSocket;
    input: InputHandler;
    renderer: GameRenderer;
} | null = null;

export function initGameIfHome() {
    if (window.location.pathname !== '/' && window.location.pathname !== '/home') {
        // Disconnect WebSocket and reset game instance if not on home
        if (gameInstance) {
            gameInstance.ws.disconnect();
            gameInstance = null;
        }
        return;
    }

    // If game instance already exists, do not create a new one
    if (gameInstance && gameInstance.ws.isConnected()) {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/localGame`;
    
    const gameWs = new GameWebSocket(
        wsUrl,
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
    const inputHandler = new InputHandler(gameWs);

    // Store instance
    gameInstance = { ws: gameWs, input: inputHandler, renderer };

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

// Cleanup przy zmianie strony
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameInstance) {
        gameInstance.ws.disconnect();
        gameInstance = null;
    }
});
