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

  constructor(url: string, onGameConfig: (config: GameConfig) => void, onGameState: (state: GameState) => void, onGameDisconnect?: (() => void) | undefined) {
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
      if (data.type === "gameConfig") {
        this.onGameConfig(data.config);
      } else if (data.type === "state" && data.state) {
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

      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (this.onGameDisconnect) this.onGameDisconnect();
    });

    // Disconnect if navigating away from game
    window.addEventListener('popstate', () => {
        if (window.location.pathname !== '/game/local') {
            if (this.onGameDisconnect) this.onGameDisconnect();
        }
    });
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
      console.log("Disconnecting WebSocket...");
      this.ws.close();
    }
    // Reset flags so if this instance is somehow reused, it starts with clean state
    this.gameEndedDispatched = false;
    this.lastGameEndedState = false;
  }
}
