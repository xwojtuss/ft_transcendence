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
                // ^^^^^ TRDM ^^^^^ if the game ended, dispatch a custom event with the winner index
                if (data.state.gameEnded && data.state.winner) {
                    window.dispatchEvent(new CustomEvent("gameEndedLocal", {
                        detail: data.state.winner
                    }));
                }
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
            if (window.location.pathname !== '/game/local') {
                this.disconnect();
            }
        });
    }
    // UPDATED WITH AI PLAYER: raw sender so we can greet the server with a mode.
    sendRaw(payload) {
        const trySend = () => this.ws.send(JSON.stringify(payload));
        if (this.ws.readyState === WebSocket.OPEN) {
            trySend();
            return;
        }
        const onOpen = () => {
            try {
                trySend();
            }
            finally {
                this.ws.removeEventListener('open', onOpen);
            }
        };
        this.ws.addEventListener('open', onOpen);
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
