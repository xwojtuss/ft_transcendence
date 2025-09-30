import { initCanvas, resizeCanvas, setGameDimensions } from "./gameUtils/drawBoard.js";
import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/gameRenderer.js";
/*handle to the running game, so other code (outside the init function) can reach the live objects and shut them down cleanly.
It is either:
- null → no game is running, or
- an object holding references to the WebSocket, InputHandler, and Renderer that were created when the game started.
*/
let gameInstance = null;
export function initGameIfHome(aiEnabled) {
    if (window.location.pathname !== '/game/local') {
        return;
    }
    //console.log("Initializing local game...");
    function waitForCanvas() {
        const canvas = document.getElementById("local-game-canvas"); //   // Try to grab the <canvas id="local-game-canvas"> from the DOM.
        if (!canvas) {
            setTimeout(waitForCanvas, 100);
            return;
        }
        const ctx = canvas.getContext("2d"); //Get a 2D drawing context from the canvas.
        if (!ctx) {
            console.error("Failed to get canvas context!");
            return;
        }
        initCanvas();
        let gameState = null; // // Will hold the latest game state sent by the server (type kept loose as 'any').
        const renderer = new GameRenderer(canvas, ctx); //    // Create the renderer that knows how to draw a single frame to this canvas.
        // Setup WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/localGame`;
        // /* Open the WebSocket and provide two callbacks:
        // 1) when a "config" message arrives, set field sizes
        // 2) when a "state" message arrives, update the gameState we will render */
        const gameWs = new GameWebSocket(wsUrl, (config) => {
            setGameDimensions(config.FIELD_WIDTH, config.FIELD_HEIGHT);
            renderer.setFieldDimensions(config.FIELD_WIDTH, config.FIELD_HEIGHT);
            //console.log("Game dimensions set:", config.FIELD_WIDTH, config.FIELD_HEIGHT);
        }, (state) => {
            gameState = state;
        });
        // UPDATED WITH AI PLAYER
        // Tell the server which mode this session should run
        gameWs.sendRaw({ type: "hello", mode: aiEnabled ? "ai" : "local" });
        // Setup input handling
        // Hook up keyboard/mouse/touch and send inputs through the WebSocket.
        const inputHandler = new InputHandler(gameWs);
        // Store instance
        gameInstance = { ws: gameWs, input: inputHandler, renderer };
        // Game loop
        function gameLoop() {
            renderer.render(gameState);
            requestAnimationFrame(gameLoop);
        }
        gameLoop();
        //Handle resize
        const handleResize = () => resizeCanvas();
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
