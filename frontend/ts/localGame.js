var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { initCanvas, resizeCanvas, setGameDimensions } from "./gameUtils/drawBoard.js";
import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/gameRenderer.js";
// ^^^^^ TRDM ^^^^^
// Singleton guard: prevent duplicate bridge setup & duplicate listeners across SPA inits
let tournamentBridgeSetup = false;
let lastOnEndedHandler = null;
/*handle to the running game, so other code (outside the init function) can reach the live objects and shut them down cleanly.
It is either:
- null → no game is running, or
- an object holding references to the WebSocket, InputHandler, and Renderer that were created when the game started.
*/
// ^^^^^ TRDM ^^^^^
/**
 * Bridge with the tournament flow:
 * - If "tournamentMatch" exists in sessionStorage, use those player names.
 * - If absent: make sure any leftover names are cleared so Local (2P) is clean.
 * - When the game ends, send the real winner to backend, then navigate back to the tournament page.
*/
function setupTournamentBridgeIfNeeded() {
    const raw = sessionStorage.getItem('tournamentMatch');
    // No tournament context -> make sure we're clean
    if (!raw) {
        clearTournamentContext('no-context-on-local');
        return;
    }
    // There IS a running tournament match -> set names for canvas
    const ctx = JSON.parse(raw);
    window.player1Name = ctx.player1;
    window.player2Name = ctx.player2;
    // When the real game ends, store result and go back to tournament page
    const onEnded = (e) => __awaiter(this, void 0, void 0, function* () {
        const winnerIndex = e.detail;
        const winnerAlias = (winnerIndex === 1) ? ctx.player1 : ctx.player2;
        try {
            const resultPromise = fetch(`/api/tournaments/${ctx.tournamentId}/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId: ctx.matchId, winnerAlias })
            });
            yield sleep(150);
            yield resultPromise;
        }
        catch (err) {
            console.error('Failed to store tournament result', err);
        }
        // Keep the result (tournament.ts will read it), but clear the active match + names
        try {
            sessionStorage.setItem('tournamentResult', JSON.stringify({
                tournamentId: ctx.tournamentId,
                matchId: ctx.matchId,
                winnerAlias
            }));
        }
        catch (_a) { }
        clearTournamentContext('match-finished');
        // Navigate back to tournament route in SPA
        window.history.pushState({}, "", "/game/local-tournament");
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    // ^^^^^ TRDM ^^^^^
    /* Ensure we never attach multiple onEnded listeners:
      - remove previous one if it exists
      - remember the new one
      - set a guard flag so we don’t re-run this bridge setup */
    if (lastOnEndedHandler) {
        window.removeEventListener("gameEndedLocal", lastOnEndedHandler);
        lastOnEndedHandler = null;
    }
    lastOnEndedHandler = onEnded;
    // Add the *single* listener for this game instance
    window.addEventListener("gameEndedLocal", onEnded, { once: true });
    // Mark the bridge as set up
    tournamentBridgeSetup = true;
    // --- Route watcher: if user leaves /game/local (Home/Play/etc), clear stale context ---
    // This covers SPA navigations that don't reload the page.
    const routeWatch = setInterval(() => {
        if (window.location.pathname !== '/game/local') {
            // User navigated away without finishing -> drop the context and names
            clearTournamentContext('left-local-route');
            clearInterval(routeWatch);
            if (lastOnEndedHandler) {
                window.removeEventListener("gameEndedLocal", lastOnEndedHandler);
                lastOnEndedHandler = null;
            }
            tournamentBridgeSetup = false;
        }
    }, 200);
    // Also clear on hard navigations / tab closes
    const onBeforeUnload = () => {
        clearTournamentContext('beforeunload');
        clearInterval(routeWatch);
        // ^^^^^ TRDM ^^^^^  (inside the routeWatch condition block, before/after clearInterval)
        if (lastOnEndedHandler) {
            window.removeEventListener("gameEndedLocal", lastOnEndedHandler);
            lastOnEndedHandler = null;
        }
        tournamentBridgeSetup = false;
        window.removeEventListener('beforeunload', onBeforeUnload);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
}
// ^^^^^ TRDM ^^^^^ 
/** Remove any tournament match context and ensure canvas labels are cleared. */
function clearTournamentContext(reason) {
    try {
        sessionStorage.removeItem('tournamentMatch'); // current match context
    }
    catch (_a) { }
    // Clear the global names so the canvas stops drawing them
    delete window.player1Name;
    delete window.player2Name;
}
let gameInstance = null;
export function initGameIfHome(aiEnabled) {
    if (!['/game/local', '/game/local-tournament'].includes(window.location.pathname)) {
        return;
    }
    // ^^^^^ TRDM ^^^^^  
    setupTournamentBridgeIfNeeded();
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
        /* Open the WebSocket and provide two callbacks:
            1) when a "config" message arrives, set field sizes
            2) when a "state" message arrives, update the gameState we will render */
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
        //Hook up keyboard/mouse/touch and send inputs through the WebSocket.
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
    waitForCanvas();
}
// Cleanup when page changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameInstance) {
        gameInstance.ws.disconnect();
        gameInstance = null;
    }
});
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
