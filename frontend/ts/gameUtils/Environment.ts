import { fontData } from "./KenneyMiniSquare.js";
import { BallState, GameConfig, PlayerState } from "./websocketManager.js";

const environmentConfig = {
    BACKGROUND_COLOR: BABYLON.Color4.FromHexString('#353535ff'),
    BALL_COLOR: BABYLON.Color3.FromHexString('#3e3bff'),
    BALL_SPEC_COLOR: BABYLON.Color3.FromHexString('#9031fd'),
    PADDLE_COLOR: BABYLON.Color3.FromHexString('#d17000'),
    PADDLE_SPEC_COLOR: BABYLON.Color3.FromHexString('#ff5100'),
    BOARD_COLOR: BABYLON.Color3.FromHexString('#12122b'),
    BOARD_SPEC_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    MAIN_AMBIENT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    WALL_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    SCORE_TEXT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    START_TEXT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    END_TEXT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    PLAYER_NAMES_TEXT_COLOR: BABYLON.Color3.FromHexString('#e4e4e4'),
    START_MESSAGE: "PRESS SPACE TO BEGIN",
    END_MESSAGE: (player: number) => `PLAYER ${player} WINS!\nPRESS SPACE TO RESTART`
};

export class Environment {
    private ballMesh!: BABYLON.Mesh;
    private ballTrail!: BABYLON.TrailMesh;
    private boardPlane!: BABYLON.Mesh;
    private camera: BABYLON.FreeCamera;
    private centerPoint: BABYLON.Vector3;
    private paddleMeshes!: BABYLON.Mesh[];
    private scoreText!: BABYLON.Mesh[];
    private startText!: BABYLON.Mesh;
    private endTexts!: BABYLON.Mesh[];
    private playerNames: BABYLON.Mesh[] | undefined;
    private currentScores: number[];
    private glowLayer!: BABYLON.GlowLayer;
    private wallMeshes!: BABYLON.Mesh[];
    private audioEngine?: BABYLON.AudioEngineV2;
    private ballBounceSound?: BABYLON.StaticSound;
    private failSound?: BABYLON.StaticSound;
    private applauseSound?: BABYLON.StaticSound;
    private overlayText?: BABYLON.Mesh;

    constructor(scene: BABYLON.Scene, configuration: GameConfig, canvas?: HTMLCanvasElement) {
        const numOfPlayers = 2;
        this.currentScores = Array(numOfPlayers).fill(0);
        this.centerPoint = new BABYLON.Vector3(configuration.FIELD_WIDTH / 2, -configuration.FIELD_HEIGHT / 2, 0);

        this.camera = new BABYLON.FreeCamera(
            "camera1",
            new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, -40),
            scene
        );
        this.camera.setTarget(this.centerPoint);
        if (canvas) this.camera.attachControl(canvas, true);
        this.camera.fov = Math.PI * 1.5 / 3;

        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 6, -1), scene);
        ambient.intensity = 0.1;
        const ambientColored = new BABYLON.HemisphericLight("ambientColor", new BABYLON.Vector3(0, -1, -1), scene);
        ambientColored.intensity = 0.6;
        ambientColored.diffuse = environmentConfig.MAIN_AMBIENT_COLOR;
        ambientColored.specular = environmentConfig.MAIN_AMBIENT_COLOR;

        this.glowLayer = new BABYLON.GlowLayer("glow", scene);
        this.glowLayer.intensity = 0.6;
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
        postProcessing.imageProcessing.exposure = 0.55;
        postProcessing.imageProcessing.contrast = 3;
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

        this.constructBoard(scene, configuration);
        this.constructBall(scene, configuration);
        this.constructPaddles(scene, configuration);
        this.constructScoreText(scene, configuration);
        this.constructStartText(scene, configuration);
        this.constructEndTexts(scene, configuration);
        this.constructWalls(scene, configuration);
        this.constructPlayerNames(scene, configuration);

        scene.clearColor = environmentConfig.BACKGROUND_COLOR;

        let passedThroughCenter: boolean = true;
        scene.registerBeforeRender(async () => {
            if (!this.audioEngine) await this.createSounds();
            // console.log(this.ballMesh.position.x);
            const graceZoneX = 5;
            const graceZoneY = 1.5;
            const outsideZoneX = 3;
            if (passedThroughCenter
                && ((this.ballMesh.position.x < graceZoneX
                    && this.ballMesh.position.y > this.paddleMeshes[0].position.y - configuration.PADDLE_HEIGHT / 2 - graceZoneY
                    && this.ballMesh.position.y < this.paddleMeshes[0].position.y + configuration.PADDLE_HEIGHT / 2 + graceZoneY
                ) || (this.ballMesh.position.x > configuration.FIELD_WIDTH - graceZoneX
                    && this.ballMesh.position.y > this.paddleMeshes[1].position.y - configuration.PADDLE_HEIGHT / 2 - graceZoneY
                    && this.ballMesh.position.y < this.paddleMeshes[1].position.y + configuration.PADDLE_HEIGHT / 2 + graceZoneY
                ))) {
                await this.playBallBounceSound();
                passedThroughCenter = false;
            } else if (this.ballMesh.position.x > this.centerPoint.x - graceZoneX && this.ballMesh.position.x < this.centerPoint.x + graceZoneX) {
                passedThroughCenter = true;
            } else if (!this.endTexts[0].isEnabled() && !this.endTexts[1].isEnabled()
                && (this.ballMesh.position.x < outsideZoneX || this.ballMesh.position.x > configuration.FIELD_WIDTH - outsideZoneX)) {
                await this.playBallFailSound();
            }
        });
        scene.onDispose = () => {
            this.audioEngine?.dispose();
            this.ballBounceSound?.dispose();
            this.failSound?.dispose();
            this.applauseSound?.dispose();
        };
    }

    async createSounds() {
        this.audioEngine = await BABYLON.CreateAudioEngineAsync();
        this.ballBounceSound = await BABYLON.CreateSoundAsync('ballBounce', '../assets/sounds/metal-hit.mp3', {
            volume: 0.2
        });
        this.applauseSound = await BABYLON.CreateSoundAsync('ballBounce', '../assets/sounds/applause.mp3');
        this.failSound = await BABYLON.CreateSoundAsync('ballBounce', '../assets/sounds/fail.mp3', {
            volume: 0.2
        });
    }

    async playBallBounceSound() {
        if (!this.audioEngine || !this.ballBounceSound) return;
        await this.audioEngine.unlockAsync();
        this.ballBounceSound.play();
    }

    async playBallFailSound() {
        if (!this.audioEngine || !this.failSound) return;
        await this.audioEngine.unlockAsync();
        this.failSound.play();
    }

    async playApplauseSound() {
        if (!this.audioEngine || !this.applauseSound) return;
        await this.audioEngine.unlockAsync();
        this.applauseSound.play();
    }

    setBallPosition(ballState: BallState) {
        const currentPos = new BABYLON.Vector3(ballState.x, ballState.y, this.ballMesh.position.z).multiply(new BABYLON.Vector3(1, -1, 1));
        this.ballMesh.position = currentPos;
    }

    setPaddlePositions(positionMap: { [key: number]: PlayerState }) {
        let playerKey: number;
        let playerState: PlayerState;
        for (const key in positionMap) {
            // the key starts at 1 as a string
            // so we'll use Numer(key) - 1 to reference the paddles
            playerKey = Number(key);
            playerState = positionMap[playerKey];
            this.paddleMeshes[playerKey - 1].position = new BABYLON.Vector3(
                playerState.x,
                -playerState.y,
                this.paddleMeshes[playerKey - 1].position.z
            );
        }
    }

    updatePlayerScore(players: { [key: number]: PlayerState }) {
        let playerKey: number;
        for (const player in players) {
            playerKey = Number(player) - 1;
            this.reconstructScoreText(playerKey, players[player].score);
        }
    }

    showEndText(playerKey: number) {
        this.endTexts[playerKey - 1].setEnabled(true);
    }

    hideEndText(playerKey?: number) {
        if (playerKey) {
            this.endTexts[playerKey - 1].setEnabled(false);
            return;
        }
        this.endTexts.forEach((text) => text.setEnabled(false));
    }

    hideStartText() {
        this.startText.setEnabled(false);
    }

    showStartText() {
        this.startText.setEnabled(true);
    }

    enableBallTrail() {
        this.ballTrail.setEnabled(true);
    }

    disableBallTrail() {
        this.ballTrail.setEnabled(false);
    }

    toggleCameraMovement(canvas: HTMLCanvasElement) {
        if (this.camera.inputs.attachedToElement) {
            this.camera.detachControl();
        } else {
            this.camera.attachControl(canvas, true);
        }
    }

    private constructPaddles(scene: BABYLON.Scene, config: GameConfig) {
        const numOfPlayers = 2;
        this.paddleMeshes = [];
        const mat = new BABYLON.StandardMaterial("paddleMat", scene);
        mat.emissiveColor = environmentConfig.PADDLE_COLOR;
        mat.specularColor = environmentConfig.PADDLE_SPEC_COLOR;

        for (let i = 0; i < numOfPlayers; i++) {
            const paddle = BABYLON.MeshBuilder.CreateBox(`paddle${i}`, {
                width: config.PADDLE_WIDTH,
                height: config.PADDLE_HEIGHT,
                depth: config.BALL_RADIUS
            }, scene);
            paddle.material = mat;
            paddle.position.z = -config.PADDLE_WIDTH / 2;
            this.glowLayer.addIncludedOnlyMesh(paddle);
            this.paddleMeshes.push(paddle);
        }
    }

    private constructBall(scene: BABYLON.Scene, config: GameConfig) {
        this.ballMesh = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: config.BALL_RADIUS * 2, segments: 32 }, scene);
        this.ballMesh.position = new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, -config.BALL_RADIUS);
        const mat = new BABYLON.StandardMaterial("ballMat", scene);
        mat.emissiveColor = environmentConfig.BALL_COLOR;
        mat.diffuseColor = environmentConfig.BALL_COLOR;
        mat.specularColor = environmentConfig.BALL_SPEC_COLOR;
        this.ballMesh.material = mat;
        this.glowLayer.addIncludedOnlyMesh(this.ballMesh);
        this.ballTrail = new BABYLON.TrailMesh("trail", this.ballMesh, scene, config.BALL_RADIUS * 1.5, 10, true);
        const trailMat = new BABYLON.StandardMaterial("trailMat", scene);
        this.glowLayer.addIncludedOnlyMesh(this.ballTrail);
        trailMat.emissiveColor = environmentConfig.BALL_COLOR.scale(0.6);
        trailMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
        trailMat.alpha = 0.2;
        this.ballTrail.material = trailMat;
    }

    private constructBoard(scene: BABYLON.Scene, config: GameConfig) {
        this.boardPlane = BABYLON.MeshBuilder.CreateGround("board", {
            width: config.FIELD_WIDTH + 2,
            height: config.FIELD_HEIGHT + 2
        }, scene);
        this.boardPlane.position = new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, 1);
        const mat = new BABYLON.StandardMaterial("boardMat", scene);
        mat.diffuseColor = environmentConfig.BOARD_COLOR;
        mat.specularColor = environmentConfig.BOARD_SPEC_COLOR;
        mat.alpha = 0.55;
        mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
        this.boardPlane.material = mat;
        this.boardPlane.rotate(BABYLON.Vector3.Left(), Math.PI / 2);
    }

    private constructWalls(scene: BABYLON.Scene, config: GameConfig) {
        const sides = 4;
        const wallThickness = 1;
        this.wallMeshes = new Array<BABYLON.Mesh>(sides);
        const mat = new BABYLON.StandardMaterial("wallsMat", scene);
        mat.emissiveColor = environmentConfig.WALL_COLOR;
        for (let i = 0; i < sides; i++) {
            this.wallMeshes[i] = BABYLON.MeshBuilder.CreateBox("wall" + i, {
                width: i % 2 ? 1 : config.FIELD_WIDTH + wallThickness * 3,
                height: i % 2 ? config.FIELD_HEIGHT + wallThickness * 3 : 1,
                depth: wallThickness
            });
            const offset = new BABYLON.Vector3(
                i % 2 ? config.FIELD_WIDTH / 2 + wallThickness : 0,
                i % 2 ? 0 : config.FIELD_HEIGHT / 2 + wallThickness,
                0
            );
            this.wallMeshes[i].position = i < sides / 2 ? this.centerPoint.add(offset) : this.centerPoint.subtract(offset);
            this.wallMeshes[i].material = mat;
        }
    }

    private reconstructScoreText(index: number, score: number) {
        if (this.currentScores[index] === score) return;
        const scene = this.scoreText[index].getScene();
        const mat = this.scoreText[index].material;
        const pos = this.scoreText[index].position;
        this.scoreText[index].dispose(false, false);
        const text = BABYLON.MeshBuilder.CreateText("scoreText", score.toString(), fontData, {
            size: 8,
            resolution: 16,
            depth: 1
        }, scene);
        if (!text) throw new Error('Could not create text');
        text.material = mat;
        text.position = pos;
        this.scoreText[index] = text;
        this.currentScores[index] = score;
    }

    private constructScoreText(scene: BABYLON.Scene, config: GameConfig) {
        const numOfPlayers = 2;
        this.scoreText = [];
        const mat = new BABYLON.StandardMaterial("scoreMat", scene);
        mat.emissiveColor = environmentConfig.SCORE_TEXT_COLOR;
        const xOffset = config.FIELD_WIDTH / 4;

        for (let i = 0; i <= numOfPlayers; i++) {
            const char = i === numOfPlayers ? ":" : "0";
            const text = BABYLON.MeshBuilder.CreateText("scoreText", char, fontData, {
                size: 8,
                resolution: 16,
                depth: 1
            }, scene);
            if (!text) throw new Error("Could not create text");
            this.scoreText[i] = text;
            this.scoreText[i].position.z = 0.01;
            this.scoreText[i].position.y = this.centerPoint.y + config.FIELD_HEIGHT / 4;
            this.scoreText[i].material = mat;
        }
        this.scoreText[0].position.x = this.centerPoint.x - xOffset;
        this.scoreText[2].position.x = this.centerPoint.x;
        this.scoreText[1].position.x = this.centerPoint.x + xOffset;
    }

    private constructStartText(scene: BABYLON.Scene, config: GameConfig) {
        const text = BABYLON.MeshBuilder.CreateText("startText", environmentConfig.START_MESSAGE, fontData, {
            size: 4,
            resolution: 16,
            depth: 1
        }, scene);
        const mat = new BABYLON.StandardMaterial("startTextMat", scene);
        mat.emissiveColor = environmentConfig.START_TEXT_COLOR;
        if (!text) throw new Error('Could not create text');
        text.material = mat;
        text.position = new BABYLON.Vector3(
            this.centerPoint.x,
            this.centerPoint.y - config.FIELD_HEIGHT / 4,
            0.01
        );
        this.startText = text;
        // this.glowLayer.addIncludedOnlyMesh(this.startText);
    }

    private constructEndTexts(scene: BABYLON.Scene, config: GameConfig) {
        this.endTexts = [];
        const mat = new BABYLON.StandardMaterial("endTextMat", scene);
        mat.emissiveColor = environmentConfig.END_TEXT_COLOR;
        for (let i = 0; i < 2; i++) {
            const text = BABYLON.MeshBuilder.CreateText("endText", environmentConfig.END_MESSAGE(i + 1), fontData, {
                size: 4,
                resolution: 16,
                depth: 1
            }, scene);
            if (!text) throw new Error('Could not create text');
            text.material = mat;
            text.position = new BABYLON.Vector3(
                this.centerPoint.x,
                this.centerPoint.y - config.FIELD_HEIGHT / 3,
                0.01
            );
            text.setEnabled(false);
            // this.glowLayer.addIncludedOnlyMesh(text);
            this.endTexts.push(text);
        }
    }

    private constructPlayerNames(scene: BABYLON.Scene, config: GameConfig) {
        const names = new Array<string | undefined>(2);
        names[0] = (window as any).player1Name as string | undefined;
        names[1] = (window as any).player2Name as string | undefined;

        if (!names[0] || !names[1]) return;
        this.playerNames = [];
        const mat = new BABYLON.StandardMaterial("playersTextMat", scene);
        const xOffset = config.FIELD_WIDTH / 3;
        mat.emissiveColor = environmentConfig.PLAYER_NAMES_TEXT_COLOR;
        for (let i = 0; i < 2; i++) {
            const text = BABYLON.MeshBuilder.CreateText("playersText", names[i] as string, fontData, {
                size: 3,
                resolution: 8,
                depth: 0.1
            }, scene);
            if (!text) throw new Error('Could not create text');
            text.material = mat;
            text.position = new BABYLON.Vector3(
                0,
                this.centerPoint.y + config.FIELD_HEIGHT * 3 / 7,
                0.01
            );
            // this.glowLayer.addIncludedOnlyMesh(text);
            this.playerNames.push(text);
        }
        this.playerNames[0].position.x = this.centerPoint.x - xOffset;
        this.playerNames[1].position.x = this.centerPoint.x + xOffset;
    }

    createOverlay(scene: BABYLON.Scene, message: string) {
        if (this.overlayText) {
            this.overlayText.dispose(false, true);
        }
        const text = BABYLON.MeshBuilder.CreateText("startText", message, fontData, {
            size: 3,
            resolution: 8,
            depth: 0.75
        }, scene);
        const mat = new BABYLON.StandardMaterial("startTextMat", scene);
        mat.emissiveColor = environmentConfig.START_TEXT_COLOR;
        if (!text) throw new Error('Could not create text');
        text.material = mat;
        text.position = new BABYLON.Vector3(
            this.centerPoint.x,
            this.centerPoint.y,
            1
        );
        // this.glowLayer.addIncludedOnlyMesh(this.startText);
        this.overlayText = text;
    }

    destroyOverlay() {
        this.overlayText?.dispose(false, true);
    }
}
