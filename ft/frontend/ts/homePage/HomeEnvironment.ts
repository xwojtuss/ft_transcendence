import { renderPage } from "../app.js";
import { fontData } from "../gameUtils/KenneyMiniSquare.js";

const environmentConfig = {
    BACKGROUND_COLOR: BABYLON.Color4.FromHexString('#030303ff'),
    TEXT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    GAME_MESSAGE: "CHOOSE THE GAME",
    MODE_MESSAGE: "CHOOSE THE MODE",
    BACK_BUTTON_MESSAGE: "GO BACK",
    WALL_WIDTH: 192,
    WALL_HEIGHT: 108,
    PANEL_HEIGHT: 10,
    PANEL_HOVER_HEIGHT: 11,
    BACK_BUTTON_HEIGHT: 3,
    BACK_BUTTON_HOVER_HEIGHT: 3.3,
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
    } as const
};

export class HomeEnvironment {
    private camera: BABYLON.FreeCamera;
    private glowLayer!: BABYLON.GlowLayer;
    private floor!: BABYLON.Mesh;
    private wall!: BABYLON.Mesh;
    private modeText!: BABYLON.Mesh;
    private gameText!: BABYLON.Mesh;
    private gamePanels!: Array<BABYLON.Mesh>;
    private modePanels!: Array<{ mesh: BABYLON.Mesh, requiresLogin: boolean }>;
    private modesActionManager!: BABYLON.ActionManager;
    private gamesActionManager!: BABYLON.ActionManager;
    private backActionManager!: BABYLON.ActionManager;
    private game: string | undefined;
    private backButton!: BABYLON.Mesh;

    constructor(scene: BABYLON.Scene, canvas?: HTMLCanvasElement) {
        this.camera = new BABYLON.FreeCamera(
            "camera1",
            new BABYLON.Vector3(0, 5, -20),
            scene
        );
        this.camera.setTarget(new BABYLON.Vector3(0, 10, 40));
        // if (canvas) this.camera.attachControl(canvas, true);
        this.camera.fov = Math.PI * 0.2;

        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, -2), scene);
        ambient.intensity = 1;

        this.glowLayer = new BABYLON.GlowLayer("glow", scene);
        this.glowLayer.intensity = 0.2;

        this.constructActionManagers(scene);
        this.constructStartTexts(scene);
        this.initializeGamePanels(scene);
        this.initializeGameModes(scene);
        this.constructBackButton(scene);
        this.constructWalls(scene);

        const params = new URLSearchParams(window.location.search);
        if (params.get("game") !== null) this.game = String(params.get("game"));
        if (this.game) {
            this.hideGames();
            this.showGameModes();
            this.showBackButton();
        } else {
            this.hideBackButton();
        }

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

    private constructActionManagers(scene: BABYLON.Scene) {
        this.gamesActionManager = new BABYLON.ActionManager(scene);
        HomeEnvironment.registerHover(this.gamesActionManager, environmentConfig.PANEL_HEIGHT, environmentConfig.PANEL_HOVER_HEIGHT);
        this.modesActionManager = new BABYLON.ActionManager(scene);
        HomeEnvironment.registerHover(this.modesActionManager, environmentConfig.PANEL_HEIGHT, environmentConfig.PANEL_HOVER_HEIGHT);
        this.backActionManager = new BABYLON.ActionManager(scene);
        HomeEnvironment.registerHover(this.backActionManager, environmentConfig.BACK_BUTTON_HEIGHT, environmentConfig.BACK_BUTTON_HOVER_HEIGHT);
        this.gamesActionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (evt) => {
            const mesh = evt.source;
            if (mesh.name === "ping-pongPanelH") this.game = "ping-pong";
            else if (mesh.name === "tic-tac-toePanelH") this.game = "tic-tac-toe";
            else throw new Error("Unknown game");
            this.hideGames();
            this.showGameModes();
            this.showBackButton();
            window.history.pushState({}, '', window.location.pathname + "?game=" + this.game);
        }));
        this.modesActionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (evt) => {
            const mesh = evt.source;
            if (!this.game) {
                this.hideGameModes();
                this.showGames();
                this.hideBackButton();
                throw new Error("Unknown game");
            } else if (this.game === "ping-pong" && mesh.name in environmentConfig.REDIRECTIONS.pong) {
                const key: keyof typeof environmentConfig.REDIRECTIONS.pong = mesh.name;
                renderPage(environmentConfig.REDIRECTIONS.pong[key], false);
            } else if (this.game === "tic-tac-toe" && mesh.name in environmentConfig.REDIRECTIONS.tic) {
                const key: keyof typeof environmentConfig.REDIRECTIONS.tic = mesh.name;
                renderPage(environmentConfig.REDIRECTIONS.tic[key], false);
            } else {
                throw new Error("Unknown mode");
            }
        }));
        this.backActionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (evt) => {
            this.showGames();
            this.hideGameModes();
            this.hideBackButton();
            window.history.pushState({}, '', window.location.pathname);
        }));
    }

    private static registerHover(actionManager: BABYLON.ActionManager, from: number, to: number) {
        const actionFrames = 10;
        actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, (evt) => {
            const mesh = evt.source;
            const easing = new BABYLON.QuadraticEase();
            easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
            if (mesh.parent && mesh.parent instanceof BABYLON.Mesh) {
                BABYLON.Animation.CreateAndStartAnimation(
                    "hoverUp",
                    mesh.parent,
                    "position.y",
                    60,
                    actionFrames,
                    mesh.parent.position.y,
                    to,
                    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
                    easing
                );
            }
        }));
        actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, (evt) => {
            const mesh = evt.source;
            const easing = new BABYLON.QuadraticEase();
            easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
            if (mesh.parent && mesh.parent instanceof BABYLON.Mesh) {
                BABYLON.Animation.CreateAndStartAnimation(
                    "hoverDown",
                    mesh.parent,
                    "position.y",
                    60,
                    actionFrames,
                    mesh.parent.position.y,
                    from,
                    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
                    easing
                );
            }
        }));
    }

    private showBackButton() {
        this.backButton.isVisible = true;
        this.backButton.getChildMeshes().forEach((child) => {
            child.isVisible = true;
        });
    }

    private hideBackButton() {
        this.backButton.isVisible = false;
        this.backButton.getChildMeshes().forEach((child) => {
            child.isVisible = false;
        });
    }

    private constructBackButton(scene: BABYLON.Scene) {
        let text = BABYLON.MeshBuilder.CreateText("backText", environmentConfig.BACK_BUTTON_MESSAGE, fontData, {
            size: 0.7,
            resolution: 1,
            depth: 0.5
        }, scene);
        const mat = new BABYLON.StandardMaterial("backTextMat", scene);
        mat.emissiveColor = environmentConfig.TEXT_COLOR;
        if (!text) throw new Error('Could not create text');
        text.material = mat;
        this.glowLayer.addIncludedOnlyMesh(text);
        const panel = BABYLON.MeshBuilder.CreatePlane("backPlane", {
            width: 5,
            height: 1.5
        });
        const panelMat = new BABYLON.StandardMaterial("transparentPanelMat", scene);
        panelMat.alpha = 0;
        panel.material = panelMat;
        this.backButton = text;
        panel.position.y = 0.3;
        panel.position.z = -0.5;
        panel.parent = this.backButton;
        this.backButton.position = new BABYLON.Vector3(
            0,
            environmentConfig.BACK_BUTTON_HEIGHT,
            environmentConfig.WALL_HEIGHT / 3
        );
        panel.actionManager = this.backActionManager;
    }

    private constructWalls(scene: BABYLON.Scene) {
        this.floor = BABYLON.MeshBuilder.CreatePlane("ground", { width: environmentConfig.WALL_WIDTH, height: environmentConfig.WALL_HEIGHT }, scene);
        this.floor.position = new BABYLON.Vector3(0, 0, 0);
        this.floor.rotation.x = Math.PI / 2;
        this.wall = BABYLON.MeshBuilder.CreatePlane("wall", { width: environmentConfig.WALL_WIDTH, height: environmentConfig.WALL_HEIGHT }, scene);
        this.wall.position = new BABYLON.Vector3(0, environmentConfig.WALL_HEIGHT / 2, environmentConfig.WALL_HEIGHT / 2);

        const floorMat = new BABYLON.PBRMaterial("floorMat", scene);
        this.assignPBR(scene, floorMat, "../assets/backgroundTexture");
        // floorMat.metallic = 0.9;
        floorMat.roughness = 0.22;
        floorMat.useRoughnessFromMetallicTextureAlpha = false;
        floorMat.environmentIntensity = 0.2;

        const mirror = new BABYLON.MirrorTexture("mirror", 512, scene, true);
        mirror.mirrorPlane = new BABYLON.Plane(0, -1, 0, 0);
        mirror.blurKernel = 8;
        mirror.blurRatio = 0.5;
        mirror.renderList?.push(this.gameText);
        mirror.renderList?.push(this.modeText);
        this.gamePanels.forEach((panel, index) => {
            mirror.renderList?.push(panel);
            panel.getChildren().forEach((child) => {
                if (!(child instanceof BABYLON.Mesh)) return;
                mirror.renderList?.push(child);
            });
        });
        this.modePanels.forEach((panel, index) => {
            mirror.renderList?.push(panel.mesh);
            panel.mesh.getChildren().forEach((child) => {
                if (!(child instanceof BABYLON.Mesh)) return;
                mirror.renderList?.push(child);
            });
        });
        mirror.renderList?.push(this.backButton);
        this.floor.material = floorMat;
        const wallMat = floorMat.clone("wallMat");
        wallMat.reflectionTexture = scene.environmentTexture;
        this.wall.material = wallMat;
        floorMat.reflectionTexture = mirror;
        floorMat.reflectivityColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        floorMat.albedoColor = new BABYLON.Color3(1, 1, 1);
    }

    private constructStartTexts(scene: BABYLON.Scene) {
        let text = BABYLON.MeshBuilder.CreateText("gameText", environmentConfig.GAME_MESSAGE, fontData, {
            size: 3,
            resolution: 1,
            depth: 1
        }, scene);
        const mat = new BABYLON.StandardMaterial("startTextMat", scene);
        mat.emissiveColor = environmentConfig.TEXT_COLOR;
        if (!text) throw new Error('Could not create text');
        text.material = mat;
        text.position = new BABYLON.Vector3(
            0,
            environmentConfig.WALL_HEIGHT / 6,
            environmentConfig.WALL_HEIGHT / 3
        );
        this.gameText = text;
        this.glowLayer.addIncludedOnlyMesh(text);
        text = BABYLON.MeshBuilder.CreateText("modeText", environmentConfig.MODE_MESSAGE, fontData, {
            size: 3,
            resolution: 1,
            depth: 1
        }, scene);
        if (!text) throw new Error('Could not create text');
        text.material = mat;
        text.position = new BABYLON.Vector3(
            0,
            environmentConfig.WALL_HEIGHT / 6,
            environmentConfig.WALL_HEIGHT / 3
        );
        this.modeText = text;
        this.modeText.isVisible = false;
        this.glowLayer.addIncludedOnlyMesh(text);
    }

    private assignPBR(scene: BABYLON.Scene, material: BABYLON.PBRMaterial, path: string) {
        let texture = new BABYLON.Texture(path + "_albedo.png", scene);
        texture.uScale = 7;
        texture.vScale = 4.2;
        material.albedoTexture = texture;
        texture = new BABYLON.Texture(path + "_ambient.png", scene);
        texture.uScale = 7;
        texture.vScale = 4.2;
        material.ambientTexture = texture;
        texture = new BABYLON.Texture(path + "_normal.png", scene);
        texture.uScale = 7;
        texture.vScale = 4.2;
        material.bumpTexture = texture;
        texture = new BABYLON.Texture(path + "_specular.png", scene);
        texture.uScale = 7;
        texture.vScale = 4.2;
        material.metallicTexture = texture
        material.useRoughnessFromMetallicTextureAlpha = false;
        material.useRoughnessFromMetallicTextureGreen = false;
        material.useMetallnessFromMetallicTextureBlue = true;
    }

    public hideGames() {
        this.gamePanels.forEach((panel) => {
            panel.isVisible = false;
            panel.getChildMeshes(true).forEach((child) => {
                child.isVisible = false;
            });
        });
        this.gameText.isVisible = false;
    }

    public showGames() {
        this.gamePanels.forEach((panel) => {
            panel.isVisible = true;
            panel.getChildMeshes(true).forEach((child) => {
                child.isVisible = true;
            });
        });
        this.gameText.isVisible = true;
    }

    private initializeGamePanels(scene: BABYLON.Scene) {
        const games = ["ping-pong", "tic-tac-toe"];
        const gamesDesc = ["Ping Pong", "Tic-Tac-Toe"];
        const maxXSpan = environmentConfig.WALL_WIDTH / 10;
        const offsetX = maxXSpan / (games.length - 1);
        const startX = -offsetX * (games.length - 1) / 2;

        this.gamePanels = new Array<BABYLON.Mesh>(games.length);
        games.forEach((game, index) => {
            const outline = this.constructGamePanel(scene, 10, 10, 1, 0.2, `./assets/${game}-game.svg`, 0.7, `${game}Panel`, gamesDesc[index], false);
            outline.position = new BABYLON.Vector3(startX + offsetX * index, environmentConfig.PANEL_HEIGHT, 35);
            outline.rotation.y = outline.position.x / Math.abs(outline.position.x) * Math.PI / 6;
            this.gamePanels[index] = outline;
        })
    }

    public hideGameModes() {
        this.modePanels.forEach((panel) => {
            panel.mesh.isVisible = false;
            panel.mesh.getChildMeshes(true).forEach((child) => {
                child.isVisible = false;
            });
        });
        this.modeText.isVisible = false;
    }

    public showGameModes(isLoggedIn: boolean = true) {
        this.modePanels.forEach((panel) => {
            if (panel.requiresLogin && !isLoggedIn) return;
            panel.mesh.isVisible = true;
            panel.mesh.getChildMeshes(true).forEach((child) => {
                child.isVisible = true;
            });
        });
        this.modeText.isVisible = true;
    }

    private initializeGameModes(scene: BABYLON.Scene) {
        const modes = ["local", "online", "tournament", "ai"];
        const modesDesc = ["Local", "Online", "Tournament", "AI"];
        const maxXSpan = environmentConfig.WALL_WIDTH / 6;
        const offsetX = maxXSpan / (modes.length - 1);
        const startX = -offsetX * (modes.length - 1) / 2;

        this.modePanels = new Array<{ mesh: BABYLON.Mesh, requiresLogin: boolean}>(modes.length);
        modes.forEach((mode, index) => {
            const outline = this.constructGamePanel(scene, 10, 10, 1, 0.2, `./assets/${mode}-mode.svg`, 0.7, `${mode}Panel`, modesDesc[index], true);
            outline.position = new BABYLON.Vector3(startX + offsetX * index, environmentConfig.PANEL_HEIGHT, 35);
            outline.rotation.y = outline.position.x / Math.abs(outline.position.x) * Math.PI / 6;
            outline.isVisible = false;
            outline.getChildren().forEach((child) => {
                if (!child || !(child instanceof BABYLON.Mesh)) return;
                child.isVisible = false;
            });
            this.modePanels[index] = { mesh: outline, requiresLogin: mode === "online" };
        })
    }

    private constructGamePanel(
        scene: BABYLON.Scene,
        width: number = 4,
        height: number = 2,
        radius: number = 0.3,
        lineThickness: number = 0.02,
        svgUrl: string,
        svgScale: number = 0.5,
        panelName: string = "panel",
        description: string,
        isMode: boolean
    ) {
        const shape: BABYLON.Vector3[] = [];
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
            resolution: 1,
            depth: 0.1
        }, scene);
        if (isMode) {
            svgPlane.actionManager = this.modesActionManager;
        } else {
            svgPlane.actionManager = this.gamesActionManager;
        }
        if (!text) return outline;
        text.material = outlineMat;
        text.parent = outline;
        text.position = new BABYLON.Vector3(0, -width * svgScale / 2 - width / 12, 0.1);
        this.glowLayer.addIncludedOnlyMesh(text);

        return outline;
    }

    toggleCameraMovement(canvas: HTMLCanvasElement) {
        if (this.camera.inputs.attachedToElement) {
            this.camera.detachControl();
        } else {
            this.camera.attachControl(canvas, true);
        }
    }
}