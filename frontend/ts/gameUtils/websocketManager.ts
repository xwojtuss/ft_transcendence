export class GameWebSocket {
  private ws: WebSocket;
  private onGameConfig: (config: any) => void;
  private onGameState: (state: any) => void;

  constructor(url: string, onGameConfig: (config: any) => void, onGameState: (state: any) => void) {
    this.onGameConfig = onGameConfig;
    this.onGameState = onGameState;
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
      } else if (data.type === "waiting" || data.type === "ready") {
        this.onGameState(data);
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
      if (
        window.location.pathname !== '/game/local' &&
        window.location.pathname !== '/game/online'
      ) {
        this.disconnect();
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("Disconnecting WebSocket...");
      this.ws.close();
    }
  }
}
