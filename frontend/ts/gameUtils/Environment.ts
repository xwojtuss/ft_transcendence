import { fontData } from "./KenneyMiniSquare.js";
import { BallState, GameConfig, PlayerState } from "./websocketManager.js";

const environmentConfig = {
    BALL_COLOR: BABYLON.Color3.White(),
    PADDLE_COLOR: BABYLON.Color3.White(),
    BOARD_COLOR: new BABYLON.Color3(128/255, 128/255, 128/255),
    WALL_COLOR: BABYLON.Color3.Red(),
    SCORE_TEXT_COLOR: BABYLON.Color3.White(),
    START_MESSAGE: "Press SPACE to start",
    START_TEXT_COLOR: BABYLON.Color3.White(),
    END_MESSAGE: (player: number) => {
        return `Player ${player} Won!\nPress SPACE to play again`;
    },
    END_TEXT_COLOR: BABYLON.Color3.White(),
}

export class Environment {
    private ballMesh!: BABYLON.Mesh;
    private ballLight!: BABYLON.PointLight;
    private boardPlane!: BABYLON.Mesh;
    private camera: BABYLON.FreeCamera; // TODO change to static
    private centerPoint: BABYLON.Vector3;
    private paddleMeshes!: Array<BABYLON.Mesh>;
    private scoreText!: Array<BABYLON.Mesh>;
    private startText!: BABYLON.Mesh;
    private endTexts!: Array<BABYLON.Mesh>;
    private currentScores: Array<number>;

    constructor(scene: BABYLON.Scene, configuration: GameConfig, canvas?: HTMLCanvasElement) {
        const numOfPlayers = 2;
        this.currentScores = new Array<number>(numOfPlayers);
        this.currentScores.fill(0);
        this.centerPoint = new BABYLON.Vector3(configuration.FIELD_WIDTH / 2, -configuration.FIELD_HEIGHT / 2, 0)
        this.camera = new BABYLON.FreeCamera("camera1", 
            new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, -90), scene);
        this.camera.setTarget(this.centerPoint);
        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, -1), scene);
        ambient.intensity = 0.2;
        const motionBlur = new BABYLON.MotionBlurPostProcess("motionBlur", scene, {}, this.camera);
        motionBlur.activate(this.camera);
        if (canvas) this.camera.attachControl(canvas, true);
        this.constructBall(scene, configuration);
        this.constructBoard(scene, configuration);
        this.constructPaddles(scene, configuration);
        this.constructScoreText(scene, configuration);
        this.constructStartText(scene, configuration);
        this.constructEndTexts(scene, configuration);
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

    private constructPaddles(scene: BABYLON.Scene, configuration: GameConfig) {
        const numOfPlayers = 2;
        this.paddleMeshes = new Array<BABYLON.Mesh>(numOfPlayers);
        const paddleMaterial = new BABYLON.StandardMaterial("paddleMat", scene);
        paddleMaterial.emissiveColor = environmentConfig.PADDLE_COLOR;
        paddleMaterial.diffuseColor = environmentConfig.PADDLE_COLOR;
        const glowLayer = new BABYLON.GlowLayer("paddleGlow", scene);
        glowLayer.intensity = 0.3;
        // result[0] is the left paddle
        for (let i = 0; i < numOfPlayers; i++) {
            this.paddleMeshes[i] = BABYLON.MeshBuilder.CreateBox("paddle" + i, {
                width: configuration.PADDLE_WIDTH,
                height: configuration.PADDLE_HEIGHT,
                depth: configuration.BALL_RADIUS
            }, scene);
            this.paddleMeshes[i].position.z = -configuration.PADDLE_WIDTH / 2;
            this.paddleMeshes[i].material = paddleMaterial;
            glowLayer.addIncludedOnlyMesh(this.paddleMeshes[i]);
        }
    }

    private constructBall(scene: BABYLON.Scene, configuration: GameConfig) {
        this.ballMesh = BABYLON.MeshBuilder.CreateSphere("sphere", 
            {diameter: configuration.BALL_RADIUS * 2, segments: 16}, scene);
        this.ballMesh.receiveShadows = false;
        this.ballLight = new BABYLON.PointLight("light", 
            this.ballMesh.position, scene);
        this.ballLight.parent = this.ballMesh;
        this.ballLight.diffuse = environmentConfig.BALL_COLOR;
        this.ballLight.specular = environmentConfig.BALL_COLOR;
        this.ballMesh.position = new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, -configuration.BALL_RADIUS);
        this.ballLight.intensity = 0.7;
        this.ballLight.excludedMeshes.push(this.ballMesh);
        const ballMaterial = new BABYLON.StandardMaterial("ballMat", scene);
        ballMaterial.disableLighting = true;
        ballMaterial.emissiveColor = environmentConfig.BALL_COLOR;
        ballMaterial.diffuseColor = environmentConfig.BALL_COLOR;
        this.ballMesh.material = ballMaterial;
        const glowLayer = new BABYLON.GlowLayer("ballGlow", scene);
        glowLayer.intensity = 0.3;
        glowLayer.addIncludedOnlyMesh(this.ballMesh);
    }

    private constructBoard(scene: BABYLON.Scene, configuration: GameConfig) {
        this.boardPlane = BABYLON.MeshBuilder.CreatePlane("ground", {
            width: configuration.FIELD_WIDTH,
            height: configuration.FIELD_HEIGHT
        }, scene);
        this.boardPlane.position = this.centerPoint;
        const boardMaterial = new BABYLON.StandardMaterial("groundMat", scene);
        boardMaterial.diffuseColor = environmentConfig.BOARD_COLOR;
        boardMaterial.roughness = 0.1;
        this.boardPlane.material = boardMaterial;
    }

    private reconstructScoreText(index: number, score: number) {
        if (this.currentScores[index] === score) return;
        const scene = this.scoreText[index].getScene();
        const material = this.scoreText[index].material;
        const position = this.scoreText[index].position;
        this.scoreText[index].dispose(false, false);
        const text = BABYLON.MeshBuilder.CreateText("scoreText", score.toString(), fontData, {
            size: 8,
            resolution: 16,
            depth: 1
        }, scene);
        if (!text) throw new Error("Could not create text");
        this.scoreText[index] = text;
        this.scoreText[index].material = material;
        this.scoreText[index].position = position;
        this.currentScores[index] = score;
    }

    private constructScoreText(scene: BABYLON.Scene, configuration: GameConfig) {
        const numOfPlayers = 2;
        this.scoreText = new Array<BABYLON.Mesh>(numOfPlayers + 1); // plus one for the delimiter
        let text: BABYLON.Nullable<BABYLON.Mesh>;
        const scoreMaterial = new BABYLON.StandardMaterial("scoreMat", scene);
        scoreMaterial.emissiveColor = environmentConfig.SCORE_TEXT_COLOR;
        scoreMaterial.diffuseColor = environmentConfig.SCORE_TEXT_COLOR;
        const glowLayer = new BABYLON.GlowLayer("scoreTextGlow", scene);
        glowLayer.intensity = 0.3;
        const xOffset = configuration.FIELD_WIDTH / 4;
        for (let i = 0; i <= numOfPlayers; i++) {
            text = BABYLON.MeshBuilder.CreateText("scoreText", i === numOfPlayers ? ":" : "0", fontData, {
                size: 8,
                resolution: 16,
                depth: 1
            }, scene);
            if (!text) throw new Error("Could not create text");
            this.scoreText[i] = text;
            this.scoreText[i].position.z = 0.01;
            this.scoreText[i].position.y = this.centerPoint.y + configuration.FIELD_HEIGHT / 4;
            this.scoreText[i].material = scoreMaterial;
            glowLayer.addIncludedOnlyMesh(this.scoreText[i]);
        }
        this.scoreText[0].position.x = this.centerPoint.x - xOffset;
        this.scoreText[2].position.x = this.centerPoint.x;
        this.scoreText[1].position.x = this.centerPoint.x + xOffset;
    }

    private constructStartText(scene: BABYLON.Scene, configuration: GameConfig) {
        const text = BABYLON.MeshBuilder.CreateText("startText", "PRESS SPACE TO PLAY", fontData, {
            size: 4,
            resolution: 16,
            depth: 1
        }, scene);
        if (!text) throw new Error("Could not create text");
        this.startText = text;
        this.startText.position.x = this.centerPoint.x;
        this.startText.position.z = 0.01;
        this.startText.position.y = this.centerPoint.y - configuration.FIELD_HEIGHT / 4;
        const startMaterial = new BABYLON.StandardMaterial("startTextMat", scene);
        startMaterial.emissiveColor = environmentConfig.START_TEXT_COLOR;
        startMaterial.diffuseColor = environmentConfig.START_TEXT_COLOR;
        this.startText.material = startMaterial;
        const glowLayer = new BABYLON.GlowLayer("startTextGlow", scene);
        glowLayer.intensity = 0.3;
        glowLayer.addIncludedOnlyMesh(this.startText);
    }

    private constructEndTexts(scene: BABYLON.Scene, configuration: GameConfig) {
        const numOfPlayers = 2;
        let text: BABYLON.Nullable<BABYLON.Mesh>;
        this.endTexts = new Array<BABYLON.Mesh>(numOfPlayers);
        const endMaterial = new BABYLON.StandardMaterial("endTextMat", scene);
        endMaterial.emissiveColor = environmentConfig.END_TEXT_COLOR;
        endMaterial.diffuseColor = environmentConfig.END_TEXT_COLOR;
        const glowLayer = new BABYLON.GlowLayer("endTextGlow", scene);
        glowLayer.intensity = 0.3;
        for (let i = 0; i < numOfPlayers; i++) {
            text = BABYLON.MeshBuilder.CreateText("endText", environmentConfig.END_MESSAGE(i + 1), fontData, {
                size: 4,
                resolution: 16,
                depth: 1
            }, scene);
            if (!text) throw new Error("Could not create text");
            this.endTexts[i] = text;
            this.endTexts[i].position.x = this.centerPoint.x;
            this.endTexts[i].position.y = this.centerPoint.y - configuration.FIELD_HEIGHT / 3;
            this.endTexts[i].position.z = 0.01;
            this.endTexts[i].setEnabled(false);
            this.endTexts[i].material = endMaterial;
            glowLayer.addIncludedOnlyMesh(this.endTexts[i]);
        }
    }
}