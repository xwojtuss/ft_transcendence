import { Environment } from "./Environment.js";
import { GameConfig, GameState, BallState } from "./websocketManager.js";

export class GameRenderer {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene | null = null;
    private canvas: HTMLCanvasElement;
    private config: GameConfig | null = null;
    private environment!: Environment;

    private createEngine(canvas: HTMLCanvasElement, tries: number = 1) {
        let engine: BABYLON.Engine;
        try {
            engine = new BABYLON.Engine(canvas, true);
        } catch (error) {
            console.log("Babylon has not been loaded, trying again in one second...");
            if (tries > 10) throw error;
            setTimeout(() => this.createEngine(canvas, ++tries), 1000);
            throw new Error("Engine could not be created");
        }
        return engine;
    }

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = this.createEngine(this.canvas);
    }

    startRenderLoop(gameState: GameState) {
        if (!this.config) throw new Error("Game not configured");
        this.scene = new BABYLON.Scene(this.engine);
        this.environment = new Environment(this.scene, this.config, this.canvas);
        this.engine.runRenderLoop(() => {
            this.environment.setBallPosition(gameState.ball);
            this.environment.setPaddlePositions(gameState.players);
            this.scene?.render();
        })
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
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
        this.engine.resize();
    }

    configure(gameConfiguration: GameConfig) {
        this.config = gameConfiguration;
        this.resizeGame();
    }
}