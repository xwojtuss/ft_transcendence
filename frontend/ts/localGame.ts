import { GameState, GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/GameRenderer.js";

let gameInstance: {
    ws: GameWebSocket;
    input: InputHandler;
    renderer: GameRenderer;
} | null = null;

export function copyGameState(from: GameState, to: GameState) {
    to.ball.radius = from.ball.radius;
    to.ball.x = from.ball.x;
    to.ball.y = from.ball.y;
    to.gameEnded = from.gameEnded;
    to.gameInitialized = from.gameInitialized;
    to.gameStarted = from.gameStarted;
    to.winner = from.winner;
    for(const player in from.players) {
        to.players[player].height = from.players[player].height;
        to.players[player].width = from.players[player].width;
        to.players[player].x = from.players[player].x;
        to.players[player].y = from.players[player].y;
        to.players[player].score = from.players[player].score;
    }
}

export function initLocalGame() {
    if (window.location.pathname !== '/game/local') {
        return;
    }

    function waitForCanvas() {
        const canvas = document.getElementById("local-game-canvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
        const renderer = new GameRenderer(canvas);

        let gameState: GameState | null = null;
        let previousGameState: GameState | null = null;

        // Setup WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/localGame`;
        
        const gameWs = new GameWebSocket(
            wsUrl,
            (config) => {
                renderer.configure(config);
            },
            (state) => {
                if (!gameState || !previousGameState) {
                    gameState = state;
                    previousGameState = JSON.parse(JSON.stringify(state));
                    renderer.startRenderLoop(gameState);
                    return;
                }
                copyGameState(gameState, previousGameState);
                copyGameState(state, gameState);
            },
            renderer.end.bind(renderer)
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
        // gameInstance.renderer.end();
        gameInstance = null;
    }
});
