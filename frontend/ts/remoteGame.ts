import { GameWebSocket } from "./gameUtils/websocketManager.js";

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

export function initRemoteGame(sessionId?: string) {
    if (window.location.pathname !== '/game/online') return;

    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws/remoteGame`;
    if (sessionId) wsUrl += `?sessionId=${sessionId}`;
    console.log("Connecting to WebSocket URL:", wsUrl);

    // Obsługa oczekiwania i gotowości do gry
    const gameWs = new GameWebSocket(
        wsUrl,
        () => {},
        (data) => {
            if (data.type === "waiting") {
                console.log(data.message);
            } else if (data.type === "ready") {
                console.log(data.message);
            }
        }
    );
    console.log("WebSocket initialized:", gameWs);
}
