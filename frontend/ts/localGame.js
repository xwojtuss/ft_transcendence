import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/GameRenderer.js";
/*handle to the running game, so other code (outside the init function) can reach the live objects and shut them down cleanly.
It is either:
- null → no game is running, or
- an object holding references to the WebSocket, InputHandler, and Renderer that were created when the game started.
*/
let gameInstance = null;
export function copyGameState(from, to) {
    to.ball.radius = from.ball.radius;
    to.ball.x = from.ball.x;
    to.ball.y = from.ball.y;
    to.gameEnded = from.gameEnded;
    to.gameInitialized = from.gameInitialized;
    to.gameStarted = from.gameStarted;
    to.winner = from.winner;
    for (const player in from.players) {
        to.players[player].height = from.players[player].height;
        to.players[player].width = from.players[player].width;
        to.players[player].x = from.players[player].x;
        to.players[player].y = from.players[player].y;
        to.players[player].score = from.players[player].score;
    }
}
export function initLocalGame(aiEnabled) {
    if (!window.location.pathname.startsWith('/game/local'))
        return;
    function waitForCanvas() {
        const canvas = document.getElementById("local-game-canvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement))
            return;
        const renderer = new GameRenderer(canvas);
        let gameState = null;
        let previousGameState = null;
        // Setup WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/localGame`;
        /* Open the WebSocket and provide two callbacks:
            1) when a "config" message arrives, set field sizes
            2) when a "state" message arrives, update the gameState we will render */
        const gameWs = new GameWebSocket(wsUrl, (config) => {
            renderer.configure(config);
        }, (state) => {
            if (!gameState || !previousGameState) {
                gameState = state;
                previousGameState = JSON.parse(JSON.stringify(state));
                renderer.startRenderLoop(gameState);
                return;
            }
            copyGameState(gameState, previousGameState);
            copyGameState(state, gameState);
        }, renderer.end.bind(renderer));
        // UPDATED WITH AI PLAYER
        // Tell the server which mode this session should run
        gameWs.sendRaw({ type: "hello", mode: aiEnabled ? "ai" : "local" });
        // Setup input handling
        //Hook up keyboard/mouse/touch and send inputs through the WebSocket.
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
// Cleanup when page changes
document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || !(target instanceof HTMLElement) || !gameInstance)
        return;
    if (target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href) {
            gameInstance.ws.disconnect();
            gameInstance = null;
        }
    }
});
