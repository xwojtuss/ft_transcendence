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

export function initRemoteGame() {
    if (window.location.pathname !== '/game/online') return;

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
        () => {},
        (data) => {
            console.debug("[FRONT DEBUG] Otrzymano wiadomość z backendu:", data);
            if (data.sessionId && data.sessionId !== sessionId) {
                localStorage.setItem("sessionId", data.sessionId);
                sessionId = data.sessionId;
                console.debug(`[FRONT DEBUG] Zapisano nowy sessionId: ${sessionId}`);
            }
            if (data.type === "waiting") {
                console.log(data.message);
            } else if (data.type === "ready") {
                console.log(data.message);
            } else if (data.type === "reconnected") {
                console.log(data.message);
            }
        }
    );
    (window as any).activeGameWs = gameWs;
    console.debug("[FRONT DEBUG] WebSocket initialized:", gameWs);

    window.addEventListener("beforeunload", () => {
        if (gameWs) gameWs.close();
    });
    window.addEventListener("popstate", () => {
        if (gameWs) gameWs.close();
    });
}

