import { Environment } from "./Environment.js";
import { GameConfig, GameState, RemoteGameState } from "./websocketManager.js";

export class GameRenderer {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene | null = null;
    private canvas: HTMLCanvasElement;
    private config: GameConfig | null = null;
    private environment!: Environment;
    private initialized: boolean;
    private isConfigured: boolean = false;
    private isRemote: boolean = false;
    private configFallback: GameConfig = {
        FIELD_WIDTH: 150,
        FIELD_HEIGHT: 70,
        PADDLE_HEIGHT: 12,
        PADDLE_WIDTH: 2,
        BALL_RADIUS: 1
    };

    private createEngine(canvas: HTMLCanvasElement, tries: number = 1) {
        let engine: BABYLON.Engine;
        try {
            engine = new BABYLON.Engine(canvas, true);
        } catch (error) {
            // console.log("Babylon has not been loaded, trying again in one second...");
            if (tries > 10) throw error;
            setTimeout(() => this.createEngine(canvas, ++tries), 1000);
            throw new Error("Engine could not be created");
        }
        return engine;
    }

    constructor(canvas: HTMLCanvasElement, isRemote: boolean = false) {
        this.isRemote = isRemote;
        this.canvas = canvas;
        this.engine = this.createEngine(this.canvas);
        this.initialized = false;
        // ensure only one renderer is active per window
        if ((window as any).renderer) (window as any).renderer.end();
        (window as any).renderer = this;
    }

    end() {
        this.scene?.dispose();
        this.engine.dispose();
    }

    private beforeRenderLoop(gameState: any) {
        this.environment.setBallPosition(gameState.ball);
        this.environment.setPaddlePositions(gameState.players);
        if (gameState.gameEnded && gameState.winner) {
            // Game just ended
            this.environment.updatePlayerScore(gameState.players);
            if (this.scene && this.config) {
                this.environment.showEndText(this.scene, this.config, this.isRemote, gameState.winner);
            }
        } else if (gameState.gameInitialized) {
            // Game has been initialized - user pressed space
            this.environment.updatePlayerScore(gameState.players);
            this.environment.hideStartText();
            this.environment.hideEndText();
        }
        if (!gameState.gameInitialized && !gameState.gameEnded && !gameState.gameStarted) {
            this.environment.hideEndText();
            this.environment.showStartText();
        }
        if (!gameState.gameStarted) {
            this.environment.disableBallTrail();
        } else if (gameState.gameStarted && gameState.gameInitialized) {
            this.environment.enableBallTrail();
        }
    }

    startRenderLoop(gameState: any) {
        let playedSound: boolean = false;

        this.engine.runRenderLoop(() => {
            // the renderer needs to be configured to change things on the scene
            if (!this.isConfigured) return;
            const isGameState = gameState && gameState.type === "state";
            if (isGameState) this.beforeRenderLoop(gameState);
            if (this.engine.areAllEffectsReady() && this.scene?.isReady) this.scene?.render();
            if (!isGameState) return;
            if (!playedSound && gameState.gameEnded && gameState.winner) {
                this.environment.playApplauseSound();
                playedSound = true;
            } else if (playedSound && !gameState.gameEnded && gameState.gameInitialized) {
                playedSound = false;
            }
        })
        if (this.initialized) return;
        if (!this.config) {
            this.config = this.configFallback;
            this.resizeGame();
        }
        this.scene = new BABYLON.Scene(this.engine);
        this.environment = new Environment(this.scene, this.config, this.isRemote);
        this.initialized = true;
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
        window.addEventListener("keydown", (e) => {
            if (e.key !== "c") return;
            this.environment.toggleCameraMovement(this.canvas);
        })
    }

    resizeGame() {
        const maxHeight = window.innerHeight * 0.8;

        // Use aspect ratio from backend
        let aspectRatio;
        if (this.config) {
            aspectRatio = this.config.FIELD_WIDTH / this.config.FIELD_HEIGHT;
        } else {
            aspectRatio = 150/70;
        }
    
        const availableWidth = window.innerWidth * 0.9;
        const availableHeight = window.innerHeight * 0.8;
    
        let width = availableWidth;
        let height = width / aspectRatio;
    
        if (height > availableHeight || height > maxHeight) {
            height = Math.min(availableHeight, maxHeight);
            width = height * aspectRatio;
        }
    
        this.canvas.width = width;
        this.canvas.height = Math.min(height, maxHeight);
        // this.engine.resize();
    }

    configure(gameConfiguration: GameConfig) {
        this.config = gameConfiguration;
        this.isConfigured = true;
        this.resizeGame();
    }

    setOverlayMessage(message: string | null) {
        if (message && this.scene) {
            this.environment.createOverlay(this.scene, message);
        } else if (this.scene) {
            this.environment.destroyOverlay();
        }
    }

    displayPlayerNames(currentUser: string, opponent: string, currentUserId: number) {
        if (!this.scene || !this.config) return;
        const names = new Array<string>(2);
        if (currentUserId === 1) {
            names[0] = currentUser;
            names[1] = opponent;
        } else {
            names[0] = opponent;
            names[1] = currentUser;
        }
        this.environment.updatePlayerNames(this.scene, this.config, names);
    }

    get configured() {
        return this.isConfigured;
    }

    get isInitialized() {
        return this.initialized;
    }
}