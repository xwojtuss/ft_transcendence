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

export interface RemoteGameState extends GameState {
    winnerNick: string | null;
    loserNick: string | null;
}

export interface PlayerState {
    x: number;
    y: number;
    width: number;
    height: number;
    score: number;
}

export interface RemotePlayerState extends PlayerState {
    nick: string;
    connected: boolean;
    removed: boolean;
}

export interface BallState {
    x: number;
    y: number;
    radius: number;
}

export interface FieldState {
    width: number;
    height: number;
}

export class GameWebSocket {
  private ws: WebSocket;
  private onGameConfig: (config: any) => void;
  private onGameState: (state: any) => void;
  private onGameDisconnect: undefined | (() => void);
  private gameEndedDispatched: boolean = false;
  private lastGameEndedState: boolean = false;

  constructor(url: string, onGameConfig: (config: GameConfig) => void, onGameState: (state: GameState | RemoteGameState) => void, onGameDisconnect?: (() => void) | undefined) {
        this.onGameConfig = onGameConfig;
        this.onGameState = onGameState;
        this.onGameDisconnect = onGameDisconnect;
        this.ws = new WebSocket(url);
        this.setupEventListeners();
    }

  private setupEventListeners() {
    this.ws.onopen = () => {
        console.log("WebSocket connection established");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "config" || data.type === "gameConfig") {
            const cfg = data.config ?? { FIELD_WIDTH: data.FIELD_WIDTH, FIELD_HEIGHT: data.FIELD_HEIGHT };
            this.onGameConfig(cfg);
      } else if (data.type === "state" && data.state) {
            // state messages contain the actual game state
            this.onGameState(data.state);

            // Track gameEnded state transitions to reset flag when a new game starts
            const currentGameEnded = data.state.gameEnded || false;
            // Detect transition from 'ended' -> 'not ended' which indicates a new game started
            if (this.lastGameEndedState && !currentGameEnded) {
                // Game was ended, now it's not (new game started) - reset the flag
                this.gameEndedDispatched = false;
            }
            this.lastGameEndedState = currentGameEnded;

            // ^^^^^ TRDM ^^^^^ if the game ended, dispatch a custom event with the winner index
            // Only dispatch once per game to prevent duplicate tournament results
            if (data.state.gameEnded && data.state.winner && !this.gameEndedDispatched) {
                this.gameEndedDispatched = true;
                window.dispatchEvent(new CustomEvent("gameEndedLocal", {
                    detail: data.state.winner
                }));
            }
        } else if (data.type === "waiting" || data.type === "ready") {
            this.onGameState(data);
        } else if (data.type === "waitForRec") {
            // new server message informing opponent disconnected
            console.log("waitForRec received:", data);
            this.onGameState(data);
        } else if (data.type === "error") {
            console.error("Error from server:", data.message);
        } else if (data.type === "reconnected") {
            this.onGameState(data);
        }
    };

    this.ws.onclose = () => {
        console.log("WebSocket connection closed");
    };

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (this.onGameDisconnect) this.onGameDisconnect();
    });

    const checkRouteChange = () => {
      if (
        window.location.pathname !== "/game/online" &&
        window.location.pathname !== "/game/local" &&
        this.onGameDisconnect
      ) {
        this.onGameDisconnect();
      }
    };

    // Back/forward navigation (popstate)
    window.addEventListener("popstate", checkRouteChange);
  }

  // UPDATED WITH AI PLAYER: raw sender so we can greet the server with a mode.

  public sendRaw(payload: any): void {
    const trySend = () => this.ws.send(JSON.stringify(payload));

    if (this.ws.readyState === WebSocket.OPEN) {
      trySend();
      return;
    }

    const onOpen = () => {
      try {
        trySend();
      } finally {
        this.ws.removeEventListener('open', onOpen as any);
      }
    };
    this.ws.addEventListener('open', onOpen as any);
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
      console.log("Disconnecting WebSocket... informing server first");
      try {
        this.ws.send(JSON.stringify({ type: "clientDisconnecting" }));
      } catch (err) {
        console.warn("Failed to send disconnect message:", err);
      }
      this.ws.close();
    }
    // Reset flags so if this instance is somehow reused, it starts with clean state
    this.gameEndedDispatched = false;
    this.lastGameEndedState = false;
  }

  public close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
    }
  }
}
