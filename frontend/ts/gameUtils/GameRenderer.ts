import { GameConfig } from "./websocketManager";

export class GameRenderer {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene | null = null;
    private canvas: HTMLCanvasElement;
    private config: GameConfig | null = null;

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

    private createScene(canvas: HTMLCanvasElement) {
        const scene = new BABYLON.Scene(this.engine);
        const camera = new BABYLON.FreeCamera("camera1", 
            new BABYLON.Vector3(0, 5, -10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(canvas, true);
        const light = new BABYLON.HemisphericLight("light", 
            new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
        const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", 
            {diameter: 2, segments: 32}, scene);
        sphere.position.y = 1;
        const ground = BABYLON.MeshBuilder.CreateGround("ground", 
            {width: 6, height: 6}, scene);
        return scene;
    }

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = this.createEngine(this.canvas);
    }

    startRenderLoop() {
        this.scene = this.createScene(this.canvas);
        this.engine.runRenderLoop(() => {
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