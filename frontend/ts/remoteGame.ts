import { initCanvas, resizeCanvas, setGameDimensions } from "./gameUtils/drawBoard.js";
import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/gameRenderer.js";

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
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context!");
            return;
        }

        initCanvas();

        let gameState: any = null;
        const renderer = new GameRenderer(canvas, ctx);

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
                const width = config?.width ?? config?.FIELD_WIDTH ?? config?.fieldWidth;
                const height = config?.height ?? config?.FIELD_HEIGHT ?? config?.fieldHeight;
                if (width && height) {
                    // inform drawBoard and renderer about real field dimensions
                    setGameDimensions(width, height);
                    renderer.setFieldDimensions(width, height);
                }
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
                    return;
                }

                // Otherwise, treat it as a meta message
                if (data?.sessionId && data.sessionId !== sessionId) {
                    localStorage.setItem("sessionId", data.sessionId);
                    sessionId = data.sessionId;
                }

                if (data?.type === "waiting") {
                    // show waiting UI if needed
                    console.log(data.message);
                } else if (data?.type === "ready") {
                    console.log(data.message);
                    console.log(`You are player ${data.playerId} in session ${data.sessionId}`);
                    const youNick = typeof data.you === 'string' ? data.you : (data.you?.nick ?? '');
                    const opponentNick = typeof data.opponent === 'string' ? data.opponent : (data.opponent?.nick ?? '');
                    console.log(`You: ${youNick}`);
                    console.log(`Opponent: ${opponentNick}`);
                } else if (data?.type === "reconnected") {
                    console.log(data.message);
                }
            }
        );

        const inputHandler = new InputHandler(gameWs);

        gameInstance = { ws: gameWs, input: inputHandler, renderer };

        function gameLoop() {
            renderer.render(gameState, "remote");
            requestAnimationFrame(gameLoop);
        }
        
        gameLoop();

        // Handle resize
        const handleResize = () => resizeCanvas();
        window.addEventListener("resize", handleResize);
        document.addEventListener("fullscreenchange", handleResize);

        (window as any).activeGameWs = gameWs;

        window.addEventListener("beforeunload", () => {
            if (gameWs) gameWs.close();
        });
        window.addEventListener("popstate", () => {
            if (gameWs) gameWs.close();
        });

    }
    
    waitForCanvas();
}
