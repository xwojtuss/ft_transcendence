import { GameState, GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/GameRenderer.js";

let gameInstance: {
    ws: GameWebSocket;
    input: InputHandler;
    renderer: GameRenderer;
} | null = null;

export function initLocalGame() {
    if (window.location.pathname !== '/game/local') {
        return;
    }

    function waitForCanvas() {
        const canvas = document.getElementById("local-game-canvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
        const renderer = new GameRenderer(canvas);

        let gameState: GameState | null = null;

        // Setup WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/localGame`;
        
        const gameWs = new GameWebSocket(
            wsUrl,
            (config) => {
                renderer.configure(config);
            },
            (state) => {
                if (!gameState) {
                    gameState = state;
                    renderer.startRenderLoop(gameState);
                    return;
                }
                gameState.ball = state.ball;
                gameState.players = state.players;
                gameState.gameEnded = state.gameEnded;
                gameState.gameInitialized = state.gameInitialized;
                gameState.gameStarted = state.gameStarted;
                gameState.winner = state.winner;
            }
        );

        // Setup input handling
        const inputHandler = new InputHandler(gameWs);


        // Store instance
        gameInstance = { ws: gameWs, input: inputHandler, renderer };

        // Handle resize
        const handleResize = () => renderer.resizeGame();
        window.addEventListener("resize", handleResize);
        document.addEventListener("fullscreenchange", handleResize);
    }

    waitForCanvas();
}

// Cleanup when page changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameInstance) {
        gameInstance.ws.disconnect();
        gameInstance = null;
    }
});
