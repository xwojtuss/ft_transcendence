export interface GameConfig { 
    FIELD_WIDTH: number,
    FIELD_HEIGHT: number,
    PADDLE_HEIGHT: number,
    PADDLE_WIDTH: number,
    BALL_RADIUS: number
}

export interface GameState {
    players: { [key: number]: PlayerState };
    ball: BallState;
    gameStarted: boolean;
    gameInitialized: boolean;
    gameEnded: boolean;
    winner: number | null;
}

export interface PlayerState {
    x: number;
    y: number;
    width: number;
    height: number;
    score: number;
}

export interface BallState {
    x: number;
    y: number;
    size: number;
}

export interface FieldState {
    width: number;
    height: number;
}
export class GameWebSocket {
    private ws: WebSocket;
    private onGameConfig: (config: GameConfig) => void;
    private onGameState: (state: GameState) => void;
    private onGameDisconnect: undefined | (() => void);

    constructor(url: string, onGameConfig: (config: GameConfig) => void, onGameState: (state: GameState) => void, onGameDisconnect?: (() => void) | undefined) {
        this.onGameConfig = onGameConfig;
        this.onGameState = onGameState;
        this.onGameDisconnect = onGameDisconnect;
        this.ws = new WebSocket(url);
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.ws.onopen = () => {
            //console.log("WebSocket connection established");
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === "gameConfig") {
                this.onGameConfig(data.config);
            } else if (data.type === "state" && data.state) {
                this.onGameState(data.state);
            }
        };

        this.ws.onclose = () => {
            //console.log("WebSocket connection closed");
        };

        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            if (this.onGameDisconnect) this.onGameDisconnect();
            this.disconnect();
        });

        // Disconnect if navigating away from game
        window.addEventListener('popstate', () => {
            if (window.location.pathname !== '/game/local') {
                if (this.onGameDisconnect) this.onGameDisconnect();
                this.disconnect();
            }
        });
    }

    sendInput(type: string, key: string) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, key }));
        }
    }

    isConnected(): boolean {
        return this.ws.readyState === WebSocket.OPEN;
    }

    disconnect() {
        if (this.onGameDisconnect) this.onGameDisconnect();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            //console.log("Disconnecting WebSocket...");
            this.ws.close();
        }
    }
}