import { HomeEnvironment } from "./HomeEnvironment.js";

export class HomeRenderer {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene | null = null;
    private canvas: HTMLCanvasElement;
    private environment!: HomeEnvironment;
    private initialized: boolean;

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

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = this.createEngine(this.canvas);
        this.initialized = false;
    }

    end() {
        this.scene?.dispose();
        this.engine.dispose();
    }

    startRenderLoop() {
        if (this.initialized) return;
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.executeWhenReady(() => {
            const loader = document.getElementById("loader");
            if (loader) loader.style.display = "none";
            this.engine.runRenderLoop(() => {
                this.scene?.render();
            });
        });
        this.environment = new HomeEnvironment(this.scene);
        this.initialized = true;
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
        window.addEventListener("keydown", (e) => {
            if (e.key !== "c") return;
            this.environment.toggleCameraMovement(this.canvas);
        });
        window.addEventListener('beforeunload', () => {
            this.end();
        });
        window.addEventListener('popstate', () => {
            this.end();
        });
    }
}