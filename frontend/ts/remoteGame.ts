import { GameState, GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/GameRenderer.js";
import { copyGameState } from "./localGame.js";

let gameInstance: {
    ws: GameWebSocket;
    input: InputHandler;
    renderer: GameRenderer;
} | null = null;

export function initRemoteGame() {
    if (window.location.pathname !== '/game/online') return;

    const currentUser = (window as any).currentUser ?? null;

    function waitForCanvas() {
        const canvas = document.getElementById("remote-game-canvas") as HTMLCanvasElement;
        if (!canvas) {
            setTimeout(waitForCanvas, 100);
            return;
        }

        const renderer = new GameRenderer(canvas);
        let gameState: GameState | null = null;
        let previousGameState: GameState | null = null;

        // Consistent playerId in localStorage
        let playerId = localStorage.getItem("playerId");
        if (!playerId) {
            playerId = crypto.randomUUID();
            localStorage.setItem("playerId", playerId);
        }

        // Retrieve sessionId from localStorage (if exists)
        let sessionId = localStorage.getItem("sessionId");

        // Construct WebSocket URL with parameters
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = `${protocol}//${window.location.host}/ws/remoteGame`;
        const params = [];
        if (sessionId) params.push(`sessionId=${sessionId}`);
        params.push(`playerId=${playerId}`);

        // Add nickname if available
        if (currentUser?.nickname) {
            params.push(`nickname=${encodeURIComponent(currentUser.nickname)}`);
        }

        wsUrl += `?${params.join("&")}`;

        // Handle messages from the backend
        const gameWs = new GameWebSocket(
            wsUrl,
            (config) => {
                renderer.configure(config);
            },
            // onGameState — may receive either the game state (players/ball) or meta messages (waiting/ready/reconnected/players)
            (state) => {
                // tolerate raw string messages from WS wrapper
                let data: any = state;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (e) { console.error('Invalid WS message (not JSON)', e); return; }
                }

                // If this looks like a game state, use it for rendering
                if (data && data.players && data.ball) {
                    gameState = data;
                    if (!gameState || !previousGameState) {
                        gameState = state;
                        previousGameState = JSON.parse(JSON.stringify(state));
                        renderer.startRenderLoop(gameState);
                        return;
                    }
                    copyGameState(gameState, previousGameState);
                    copyGameState(state, gameState);
                    // if the game ended (someone won) remove waiting overlay so win info can be shown
                    if (data.gameEnded) {
                        renderer.setOverlayMessage(null);
                    }
                    // don't clear overlay for normal state updates (keeps waitForRec visible)
                    return;
                }

                // Otherwise, treat it as a meta message (waiting/ready/waitForRec/reconnected/etc.)
                if (data?.sessionId && data.sessionId !== sessionId) {
                    localStorage.setItem("sessionId", data.sessionId);
                    sessionId = data.sessionId;
                }

                // show waiting overlay when the server explicitly tells us to wait for opponent
                if (data?.type === "waiting") {
                    console.log("Server:", data.message);
                    renderer.setOverlayMessage(data.message || "Waiting for opponent...");
                    return;
                }

                // opponent disconnected -> show persistent overlay until reconnected or game end
                if (data?.type === "waitForRec") {
                    console.log("Server:", data.message);
                    renderer.setOverlayMessage(data.message || "Opponent disconnected. Waiting for reconnection...");
                    return;
                }

                // ready/reconnected -> clear overlay so gameplay or post-game info is visible
                if (data?.type === "ready" || data?.type === "reconnected") {
                    console.log("Server:", data.message);
                    renderer.setOverlayMessage(null);
                    return;
                }

                // fallback: log other meta messages
                if (data?.type === "error") {
                    console.error("WS error:", data.message);
                } else {
                    console.log("WS meta:", data);
                }
            },
            renderer.end.bind(renderer)
        );

        const inputHandler = new InputHandler(gameWs);

        gameInstance = { ws: gameWs, input: inputHandler, renderer };

        // Handle resize
        const handleResize = () => renderer.resizeGame();
        window.addEventListener("resize", handleResize);
        document.addEventListener("fullscreenchange", handleResize);

        (window as any).activeGameWs = gameWs;

        window.addEventListener("beforeunload", () => {
            if (gameWs) gameWs.close();
            renderer.end();
        });
        window.addEventListener("popstate", () => {
            if (gameWs) gameWs.close();
            renderer.end();
        });

    }
    
    waitForCanvas();
}
