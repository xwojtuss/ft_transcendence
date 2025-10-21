import { HomeEnvironment } from "./HomeEnvironment.js";
export class HomeRenderer {
    createEngine(canvas, tries = 1) {
        let engine;
        try {
            engine = new BABYLON.Engine(canvas, true);
        }
        catch (error) {
            // console.log("Babylon has not been loaded, trying again in one second...");
            if (tries > 10)
                throw error;
            setTimeout(() => this.createEngine(canvas, ++tries), 1000);
            throw new Error("Engine could not be created");
        }
        return engine;
    }
    constructor(canvas) {
        this.scene = null;
        this.canvas = canvas;
        this.engine = this.createEngine(this.canvas);
        this.initialized = false;
    }
    end() {
        var _a;
        (_a = this.scene) === null || _a === void 0 ? void 0 : _a.dispose();
        this.engine.dispose();
    }
    startRenderLoop() {
        let playedSound = false;
        if (this.initialized)
            return;
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.executeWhenReady(() => {
            const loader = document.getElementById("loader");
            if (loader)
                loader.style.display = "none";
            this.engine.runRenderLoop(() => {
                var _a;
                (_a = this.scene) === null || _a === void 0 ? void 0 : _a.render();
            });
        });
        this.environment = new HomeEnvironment(this.scene, this.canvas);
        this.initialized = true;
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
        window.addEventListener("keydown", (e) => {
            if (e.key !== "c")
                return;
            this.environment.toggleCameraMovement(this.canvas);
        });
    }
}
