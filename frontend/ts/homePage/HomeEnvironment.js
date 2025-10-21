import { renderPage } from "../app.js";
import { fontData } from "../gameUtils/KenneyMiniSquare.js";
const environmentConfig = {
    BACKGROUND_COLOR: BABYLON.Color4.FromHexString('#353535'),
    TEXT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    GAME_MESSAGE: "CHOOSE THE GAME",
    MODE_MESSAGE: "CHOOSE THE MODE",
    WALL_WIDTH: 192,
    WALL_HEIGHT: 108,
    PANEL_HEIGHT: 10,
    PANEL_HOVER_HEIGHT: 11,
    REDIRECTIONS: {
        pong: {
            localPanelH: "/game/local",
            onlinePanelH: "/game/online",
            aiPanelH: "/game/local?ai=1",
            tournamentPanelH: "/game/local-tournament",
        },
        tic: {
            localPanelH: "/game/tic-tac-toe",
            onlinePanelH: "/game/tic-tac-toe/online",
            aiPanelH: "/game/tic-tac-toe?ai=1",
            tournamentPanelH: "/game/tic-tac-toe?matching=1",
        }
    }
};
export class HomeEnvironment {
    constructor(scene, canvas) {
        this.camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -20), scene);
        this.camera.setTarget(new BABYLON.Vector3(0, 10, 40));
        // if (canvas) this.camera.attachControl(canvas, true);
        this.camera.fov = Math.PI * 0.2;
        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, -1), scene);
        ambient.intensity = 1;
        this.glowLayer = new BABYLON.GlowLayer("glow", scene);
        this.glowLayer.intensity = 0.2;
        this.constructActionManagers(scene);
        this.constructStartTexts(scene);
        this.initializeGamePanels(scene);
        this.initializeGameModes(scene);
        this.constructWalls(scene);
        const postProcessing = new BABYLON.DefaultRenderingPipeline("default", true, scene, [this.camera]);
        postProcessing.chromaticAberrationEnabled = true;
        postProcessing.chromaticAberration.aberrationAmount = 5;
        postProcessing.bloomEnabled = true;
        postProcessing.bloomThreshold = 75;
        postProcessing.bloomWeight = 7;
        postProcessing.grainEnabled = true;
        postProcessing.grain.animated = true;
        postProcessing.grain.intensity = 7;
        postProcessing.fxaaEnabled = true;
        postProcessing.sharpenEnabled = true;
        postProcessing.sharpen.edgeAmount = 0.1;
        postProcessing.imageProcessingEnabled = true;
        // postProcessing.imageProcessing.exposure = 0.55;
        // postProcessing.imageProcessing.contrast = 3;
        postProcessing.imageProcessingEnabled = true;
        postProcessing.imageProcessing.vignetteEnabled = true;
        scene.imageProcessingConfiguration.applyByPostProcess = true;
        scene.imageProcessingConfiguration.toneMappingEnabled = false;
        scene.imageProcessingConfiguration.colorCurvesEnabled = false;
        scene.imageProcessingConfiguration.colorGradingEnabled = false;
        scene.imageProcessingConfiguration.vignetteWeight = 2.0;
        scene.imageProcessingConfiguration.vignetteStretch = 0.5;
        scene.imageProcessingConfiguration.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
        scene.imageProcessingConfiguration.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
        scene.clearColor = environmentConfig.BACKGROUND_COLOR;
    }
    constructActionManagers(scene) {
        this.gamesActionManager = new BABYLON.ActionManager(scene);
        HomeEnvironment.registerHover(this.gamesActionManager);
        this.modesActionManager = new BABYLON.ActionManager(scene);
        HomeEnvironment.registerHover(this.modesActionManager);
        this.gamesActionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (evt) => {
            const mesh = evt.source;
            console.log(mesh.name);
            if (mesh.name === "ping-pongPanelH")
                this.game = "ping-pong";
            else if (mesh.name === "tic-tac-toePanelH")
                this.game = "tic-tac-toe";
            else
                throw new Error("Unknown game");
            this.hideGames();
            this.showGameModes();
        }));
        this.modesActionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (evt) => {
            const mesh = evt.source;
            console.log(mesh.name);
            if (!this.game) {
                this.hideGameModes();
                this.showGames();
                throw new Error("Unknown game");
            }
            else if (this.game === "ping-pong" && mesh.name in environmentConfig.REDIRECTIONS.pong) {
                const key = mesh.name;
                renderPage(environmentConfig.REDIRECTIONS.pong[key], false);
            }
            else if (this.game === "tic-tac-toe" && mesh.name in environmentConfig.REDIRECTIONS.tic) {
                const key = mesh.name;
                renderPage(environmentConfig.REDIRECTIONS.tic[key], false);
            }
            else {
                throw new Error("Unknown mode");
            }
        }));
    }
    static registerHover(actionManager) {
        const actionFrames = 10;
        actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, (evt) => {
            const mesh = evt.source;
            const easing = new BABYLON.QuadraticEase();
            easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
            if (mesh.parent && mesh.parent instanceof BABYLON.Mesh) {
                BABYLON.Animation.CreateAndStartAnimation("hoverUp", mesh.parent, "position.y", 60, actionFrames, mesh.parent.position.y, environmentConfig.PANEL_HOVER_HEIGHT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, easing);
            }
        }));
        actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, (evt) => {
            const mesh = evt.source;
            const easing = new BABYLON.QuadraticEase();
            easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
            if (mesh.parent && mesh.parent instanceof BABYLON.Mesh) {
                BABYLON.Animation.CreateAndStartAnimation("hoverDown", mesh.parent, "position.y", 60, actionFrames, mesh.parent.position.y, environmentConfig.PANEL_HEIGHT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, easing);
            }
        }));
    }
    constructWalls(scene) {
        var _a, _b;
        this.floor = BABYLON.MeshBuilder.CreatePlane("ground", { width: environmentConfig.WALL_WIDTH, height: environmentConfig.WALL_HEIGHT }, scene);
        this.floor.position = new BABYLON.Vector3(0, 0, 0);
        this.floor.rotation.x = Math.PI / 2;
        this.wall = BABYLON.MeshBuilder.CreatePlane("wall", { width: environmentConfig.WALL_WIDTH, height: environmentConfig.WALL_HEIGHT }, scene);
        this.wall.position = new BABYLON.Vector3(0, environmentConfig.WALL_HEIGHT / 2, environmentConfig.WALL_HEIGHT / 2);
        const floorMat = new BABYLON.PBRMaterial("floorMat", scene);
        this.assignPBR(scene, floorMat, "../assets/backgroundTexture");
        floorMat.metallic = 0.6;
        floorMat.roughness = 0.15;
        floorMat.useRoughnessFromMetallicTextureAlpha = false;
        floorMat.environmentIntensity = 1;
        const reflectionProbe = new BABYLON.ReflectionProbe("reflectionProbe", 512, scene);
        (_a = reflectionProbe.renderList) === null || _a === void 0 ? void 0 : _a.push(this.gameText);
        (_b = reflectionProbe.renderList) === null || _b === void 0 ? void 0 : _b.push(this.modeText);
        this.gamePanels.forEach((panel, index) => {
            var _a;
            (_a = reflectionProbe.renderList) === null || _a === void 0 ? void 0 : _a.push(panel);
            panel.getChildren().forEach((child) => {
                var _a;
                if (!(child instanceof BABYLON.Mesh))
                    return;
                (_a = reflectionProbe.renderList) === null || _a === void 0 ? void 0 : _a.push(child);
            });
        });
        this.modePanels.forEach((panel, index) => {
            var _a;
            (_a = reflectionProbe.renderList) === null || _a === void 0 ? void 0 : _a.push(panel.mesh);
            panel.mesh.getChildren().forEach((child) => {
                var _a;
                if (!(child instanceof BABYLON.Mesh))
                    return;
                (_a = reflectionProbe.renderList) === null || _a === void 0 ? void 0 : _a.push(child);
            });
        });
        floorMat.reflectionTexture = reflectionProbe.cubeTexture;
        floorMat.reflectivityColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        floorMat.albedoColor = new BABYLON.Color3(1, 1, 1);
        this.floor.material = floorMat;
        this.wall.material = floorMat;
    }
    constructStartTexts(scene) {
        let text = BABYLON.MeshBuilder.CreateText("gameText", environmentConfig.GAME_MESSAGE, fontData, {
            size: 3,
            resolution: 16,
            depth: 1
        }, scene);
        const mat = new BABYLON.StandardMaterial("startTextMat", scene);
        mat.emissiveColor = environmentConfig.TEXT_COLOR;
        if (!text)
            throw new Error('Could not create text');
        text.material = mat;
        text.position = new BABYLON.Vector3(0, environmentConfig.WALL_HEIGHT / 6, environmentConfig.WALL_HEIGHT / 3);
        this.gameText = text;
        this.glowLayer.addIncludedOnlyMesh(text);
        text = BABYLON.MeshBuilder.CreateText("modeText", environmentConfig.MODE_MESSAGE, fontData, {
            size: 3,
            resolution: 16,
            depth: 1
        }, scene);
        if (!text)
            throw new Error('Could not create text');
        text.material = mat;
        text.position = new BABYLON.Vector3(0, environmentConfig.WALL_HEIGHT / 6, environmentConfig.WALL_HEIGHT / 3);
        this.modeText = text;
        this.modeText.isVisible = false;
        this.glowLayer.addIncludedOnlyMesh(text);
    }
    assignPBR(scene, material, path) {
        let texture = new BABYLON.Texture(path + "_albedo.svg", scene);
        material.albedoTexture = texture;
        texture = new BABYLON.Texture(path + "_ambient.png", scene);
        material.ambientTexture = texture;
        texture = new BABYLON.Texture(path + "_normal.png", scene);
        material.bumpTexture = texture;
        texture = new BABYLON.Texture(path + "_specular.png", scene);
        material.metallicTexture = texture;
    }
    hideGames() {
        this.gamePanels.forEach((panel) => {
            panel.isVisible = false;
            panel.getChildMeshes(true).forEach((child) => {
                child.isVisible = false;
            });
        });
        this.gameText.isVisible = false;
    }
    showGames() {
        this.gamePanels.forEach((panel) => {
            panel.isVisible = true;
            panel.getChildMeshes(true).forEach((child) => {
                child.isVisible = true;
            });
        });
        this.gameText.isVisible = true;
    }
    initializeGamePanels(scene) {
        const games = ["ping-pong", "tic-tac-toe"];
        const gamesDesc = ["Ping Pong", "Tic-Tac-Toe"];
        const maxXSpan = environmentConfig.WALL_WIDTH / 10;
        const offsetX = maxXSpan / (games.length - 1);
        const startX = -offsetX * (games.length - 1) / 2;
        this.gamePanels = new Array(games.length);
        games.forEach((game, index) => {
            const outline = this.constructGamePanel(scene, 10, 10, 1, 0.2, `./assets/${game}-game.svg`, 0.7, `${game}Panel`, gamesDesc[index], false);
            outline.position = new BABYLON.Vector3(startX + offsetX * index, environmentConfig.PANEL_HEIGHT, 35);
            outline.rotation.y = outline.position.x / Math.abs(outline.position.x) * Math.PI / 6;
            this.gamePanels[index] = outline;
        });
    }
    hideGameModes() {
        this.modePanels.forEach((panel) => {
            panel.mesh.isVisible = false;
            panel.mesh.getChildMeshes(true).forEach((child) => {
                child.isVisible = false;
            });
        });
        this.modeText.isVisible = false;
    }
    showGameModes(isLoggedIn = true) {
        this.modePanels.forEach((panel) => {
            if (panel.requiresLogin && !isLoggedIn)
                return;
            panel.mesh.isVisible = true;
            panel.mesh.getChildMeshes(true).forEach((child) => {
                child.isVisible = true;
            });
        });
        this.modeText.isVisible = true;
    }
    initializeGameModes(scene) {
        const modes = ["local", "online", "tournament", "ai"];
        const modesDesc = ["Local", "Online", "Tournament", "AI"];
        const maxXSpan = environmentConfig.WALL_WIDTH / 6;
        const offsetX = maxXSpan / (modes.length - 1);
        const startX = -offsetX * (modes.length - 1) / 2;
        this.modePanels = new Array(modes.length);
        modes.forEach((mode, index) => {
            const outline = this.constructGamePanel(scene, 10, 10, 1, 0.2, `./assets/${mode}-mode.svg`, 0.7, `${mode}Panel`, modesDesc[index], true);
            outline.position = new BABYLON.Vector3(startX + offsetX * index, environmentConfig.PANEL_HEIGHT, 35);
            outline.rotation.y = outline.position.x / Math.abs(outline.position.x) * Math.PI / 6;
            outline.isVisible = false;
            outline.getChildren().forEach((child) => {
                if (!child || !(child instanceof BABYLON.Mesh))
                    return;
                child.isVisible = false;
            });
            this.modePanels[index] = { mesh: outline, requiresLogin: mode === "online" };
        });
    }
    constructGamePanel(scene, width = 4, height = 2, radius = 0.3, lineThickness = 0.02, svgUrl, svgScale = 0.5, panelName = "panel", description, isMode) {
        const shape = [];
        const dTheta = Math.PI / 16;
        let centerX = -(0.5 * width - radius);
        let centerY = -(0.5 * height - radius);
        for (let theta = Math.PI; theta <= 1.5 * Math.PI; theta += dTheta) {
            shape.push(new BABYLON.Vector3(centerX + radius * Math.cos(theta), centerY + radius * Math.sin(theta), 0));
        }
        centerX = 0.5 * width - radius;
        for (let theta = 1.5 * Math.PI; theta <= 2 * Math.PI; theta += dTheta) {
            shape.push(new BABYLON.Vector3(centerX + radius * Math.cos(theta), centerY + radius * Math.sin(theta), 0));
        }
        centerY = 0.5 * height - radius;
        for (let theta = 0; theta <= 0.5 * Math.PI; theta += dTheta) {
            shape.push(new BABYLON.Vector3(centerX + radius * Math.cos(theta), centerY + radius * Math.sin(theta), 0));
        }
        centerX = -(0.5 * width - radius);
        for (let theta = 0.5 * Math.PI; theta <= Math.PI; theta += dTheta) {
            shape.push(new BABYLON.Vector3(centerX + radius * Math.cos(theta), centerY + radius * Math.sin(theta), 0));
        }
        shape.push(shape[0].clone());
        const outline = BABYLON.MeshBuilder.CreateTube(panelName + "_outline", {
            path: shape,
            radius: lineThickness,
            tessellation: 8,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
            updatable: false
        }, scene);
        const outlineMat = new BABYLON.StandardMaterial(panelName + "_outlineMat", scene);
        outlineMat.diffuseColor = environmentConfig.TEXT_COLOR;
        outlineMat.emissiveColor = environmentConfig.TEXT_COLOR;
        outline.material = outlineMat;
        this.glowLayer.addIncludedOnlyMesh(outline);
        const svgTexture = new BABYLON.DynamicTexture(panelName + "_svgTex", { width: 512, height: 512 }, scene, false);
        svgTexture.hasAlpha = true;
        const ctx = svgTexture.getContext();
        const img = new Image();
        img.src = svgUrl;
        img.onload = () => {
            ctx.clearRect(0, 0, 512, 512);
            const targetSize = 512 * svgScale;
            const offset = (512 - targetSize) / 2;
            ctx.drawImage(img, offset, offset, targetSize, targetSize);
            svgTexture.update();
        };
        const svgMat = new BABYLON.StandardMaterial(panelName + "_svgMat", scene);
        svgMat.diffuseTexture = svgTexture;
        svgMat.emissiveColor = environmentConfig.TEXT_COLOR;
        svgMat.backFaceCulling = false;
        const svgPlane = BABYLON.MeshBuilder.CreatePlane(panelName + "H", {
            width: width,
            height: height
        }, scene);
        svgPlane.material = svgMat;
        svgPlane.parent = outline;
        this.glowLayer.addIncludedOnlyMesh(svgPlane);
        const text = BABYLON.MeshBuilder.CreateText("startText", description, fontData, {
            size: 0.55,
            resolution: 4,
            depth: 0.1
        }, scene);
        if (isMode) {
            svgPlane.actionManager = this.modesActionManager;
        }
        else {
            svgPlane.actionManager = this.gamesActionManager;
        }
        if (!text)
            return outline;
        text.material = outlineMat;
        text.parent = outline;
        text.position = new BABYLON.Vector3(0, -width * svgScale / 2 - width / 12, 0);
        this.glowLayer.addIncludedOnlyMesh(text);
        return outline;
    }
    toggleCameraMovement(canvas) {
        if (this.camera.inputs.attachedToElement) {
            this.camera.detachControl();
        }
        else {
            this.camera.attachControl(canvas, true);
        }
    }
}
