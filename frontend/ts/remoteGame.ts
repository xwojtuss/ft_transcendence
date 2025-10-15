import { initCanvas, resizeCanvas, setGameDimensions } from "./gameUtils/drawBoard.js";
import { GameWebSocket } from "./gameUtils/websocketManager.js";
import { InputHandler } from "./gameUtils/inputHandler.js";
import { GameRenderer } from "./gameUtils/gameRenderer.js";

        // const canvas = document.getElementById("remote-game-canvas") as HTMLCanvasElement;
        // if (!canvas) {
        //     setTimeout(waitForCanvas, 100);
        //     return;
        // }
        // const ctx = canvas.getContext("2d");
        // if (!ctx) {
        //     console.error("Failed to get canvas context!");
        //     return;
        // }

        // initCanvas();

let gameInstance: {
    ws: GameWebSocket;
    input: InputHandler;
    renderer: GameRenderer;
} | null = null;

export function initRemoteGame() {
    if (window.location.pathname !== '/game/online') return;

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

        // Stały playerId w localStorage
        let playerId = localStorage.getItem("playerId");
        if (!playerId) {
            playerId = crypto.randomUUID();
            localStorage.setItem("playerId", playerId);
        }
        console.debug(`[FRONT DEBUG] playerId: ${playerId}`);

        // Pobierz sessionId z localStorage (jeśli istnieje)
        let sessionId = localStorage.getItem("sessionId");
        console.debug(`[FRONT DEBUG] sessionId (from storage): ${sessionId}`);

        // Buduj URL WebSocket z parametrami
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = `${protocol}//${window.location.host}/ws/remoteGame`;
        const params = [];
        if (sessionId) params.push(`sessionId=${sessionId}`);
        params.push(`playerId=${playerId}`);
        wsUrl += `?${params.join("&")}`;
        console.debug(`[FRONT DEBUG] Connecting to WebSocket URL: ${wsUrl}`);

        // Obsługa komunikatów z backendu
        const gameWs = new GameWebSocket(
            wsUrl,
            (config) => {
                const width = config?.width ?? config?.FIELD_WIDTH ?? config?.fieldWidth;
                const height = config?.height ?? config?.FIELD_HEIGHT ?? config?.fieldHeight;
                if (width && height) {
                    // inform drawBoard and renderer about real field dimensions
                    setGameDimensions(width, height);
                    renderer.setFieldDimensions(width, height);
                    console.debug(`[FRONT DEBUG] Applied game dimensions: ${width}x${height}`);
                }
            },
            // onGameState — may receive either the game state (players/ball) or meta messages (waiting/ready/reconnected)
            (msgOrState) => {
                // If this looks like a game state, use it for rendering
                if (msgOrState && msgOrState.players && msgOrState.ball) {
                    gameState = msgOrState;
                    return;
                }

                // Otherwise, treat it as a meta message
                const data = msgOrState;
                console.debug("[FRONT DEBUG] Otrzymano wiadomość z backendu:", data);
                if (data?.sessionId && data.sessionId !== sessionId) {
                    localStorage.setItem("sessionId", data.sessionId);
                    sessionId = data.sessionId;
                    console.debug(`[FRONT DEBUG] Zapisano nowy sessionId: ${sessionId}`);
                }
                if (data?.type === "waiting") {
                    // show waiting UI if needed
                } else if (data?.type === "ready") {
                    console.log(data.message);
                } else if (data?.type === "reconnected") {
                    console.log(data.message);
                }
            }
        );
    
        const inputHandler = new InputHandler(gameWs);

        gameInstance = { ws: gameWs, input: inputHandler, renderer };

        function gameLoop() {
            renderer.render(gameState);
            requestAnimationFrame(gameLoop);
        }
        
        gameLoop();

        // Handle resize
        const handleResize = () => resizeCanvas();
        window.addEventListener("resize", handleResize);
        document.addEventListener("fullscreenchange", handleResize);

        (window as any).activeGameWs = gameWs;
        console.debug("[FRONT DEBUG] WebSocket initialized:", gameWs);

        window.addEventListener("beforeunload", () => {
            if (gameWs) gameWs.close();
        });
        window.addEventListener("popstate", () => {
            if (gameWs) gameWs.close();
        });

    }
    
    waitForCanvas();


}
