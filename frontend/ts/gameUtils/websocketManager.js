export class GameWebSocket {
    constructor(url, onGameConfig, onGameState) {
        this.onGameConfig = onGameConfig;
        this.onGameState = onGameState;
        this.ws = new WebSocket(url);
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.ws.onopen = () => {
            console.log("WebSocket connection established");
        };
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "gameConfig") {
                this.onGameConfig(data.config);
            }
            else if (data.type === "state" && data.state) {
                this.onGameState(data.state);
            }
        };
        this.ws.onclose = () => {
            console.log("WebSocket connection closed");
        };
        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
        // Disconnect if navigating away from game
        window.addEventListener('popstate', () => {
            if (window.location.pathname !== '/' && window.location.pathname !== '/home') {
                this.disconnect();
            }
        });
    }
    sendInput(type, key) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, key }));
        }
    }
    isConnected() {
        return this.ws.readyState === WebSocket.OPEN;
    }
    disconnect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log("Disconnecting WebSocket...");
            this.ws.close();
        }
    }
}
