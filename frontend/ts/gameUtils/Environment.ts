import { BallState, GameConfig, PlayerState } from "./websocketManager.js";

const environmentConfig = {
    BALL_COLOR: BABYLON.Color3.White(),
    PADDLE_COLOR: BABYLON.Color3.White(),
    BOARD_COLOR: new BABYLON.Color3(128/255, 128/255, 128/255),
    WALL_COLOR: BABYLON.Color3.Red()
}

export class Environment {
    private ballMesh: BABYLON.Mesh;
    private ballLight: BABYLON.PointLight;
    private boardPlane: BABYLON.Mesh;
    private camera: BABYLON.FreeCamera; // TODO change to static
    private centerPoint: BABYLON.Vector3;
    private paddleMeshes: Array<BABYLON.Mesh>;

    constructor(scene: BABYLON.Scene, configuration: GameConfig, canvas?: HTMLCanvasElement) {
        this.centerPoint = new BABYLON.Vector3(configuration.FIELD_WIDTH / 2, -configuration.FIELD_HEIGHT / 2, 0)
        this.camera = new BABYLON.FreeCamera("camera1", 
            new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, -90), scene);
        this.camera.setTarget(this.centerPoint);
        if (canvas) this.camera.attachControl(canvas, true);
        this.ballMesh = BABYLON.MeshBuilder.CreateSphere("sphere", 
            {diameter: configuration.BALL_RADIUS * 2, segments: 16}, scene);
        this.ballMesh.receiveShadows = false;
        this.ballLight = new BABYLON.PointLight("light", 
            this.ballMesh.position, scene);
        this.ballLight.parent = this.ballMesh;
        this.ballMesh.position = new BABYLON.Vector3(this.centerPoint.x, this.centerPoint.y, -configuration.BALL_RADIUS);
        this.ballLight.intensity = 0.7;
        this.ballLight.excludedMeshes.push(this.ballMesh);
        this.boardPlane = BABYLON.MeshBuilder.CreatePlane("ground", {
            width: configuration.FIELD_WIDTH,
            height: configuration.FIELD_HEIGHT
        }, scene);
        this.boardPlane.position = this.centerPoint;
        this.paddleMeshes = this.createPaddles(scene, configuration);
        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, -1), scene);
        ambient.intensity = 0.2;
        this.assignMaterials(scene);
    }

    setBallPosition(ballState: BallState) {
        const currentPos = new BABYLON.Vector3(ballState.x, ballState.y, this.ballMesh.position.z).multiply(new BABYLON.Vector3(1, -1, 1));
        this.ballMesh.position = currentPos;
    }

    setPaddlePositions(positionMap: { [key: number]: PlayerState }) {
        for (const key in positionMap) {
            // the key starts at 1 as a string
            // so we'll use Numer(key) - 1 to reference the paddles
            const playerKey = Number(key);
            const playerState = positionMap[playerKey];
            this.paddleMeshes[playerKey - 1].position = new BABYLON.Vector3(
                playerState.x,
                -playerState.y,
                this.paddleMeshes[playerKey - 1].position.z
            );
        }
    }

    private assignMaterials(scene: BABYLON.Scene) {
        const ballMaterial = new BABYLON.StandardMaterial("ballMat", scene);
        ballMaterial.disableLighting = true;
        ballMaterial.emissiveColor = environmentConfig.BALL_COLOR;
        ballMaterial.diffuseColor = environmentConfig.BALL_COLOR;
        this.ballMesh.material = ballMaterial;
        const ballGlow = new BABYLON.GlowLayer("ballGlow", scene);
        ballGlow.intensity = 0.3;
        ballGlow.addIncludedOnlyMesh(this.ballMesh);
        this.ballLight.diffuse = environmentConfig.BALL_COLOR;
        this.ballLight.specular = environmentConfig.BALL_COLOR;
        const paddleMaterial = new BABYLON.StandardMaterial("paddleMat", scene);
        paddleMaterial.emissiveColor = environmentConfig.PADDLE_COLOR;
        paddleMaterial.diffuseColor = environmentConfig.PADDLE_COLOR;
        this.paddleMeshes.forEach((paddle) => {
            paddle.material = paddleMaterial;
            ballGlow.addIncludedOnlyMesh(paddle);
        });
        const boardMaterial = new BABYLON.StandardMaterial("groundMat", scene);
        boardMaterial.diffuseColor = environmentConfig.BOARD_COLOR;
        boardMaterial.roughness = 0.1;
        this.boardPlane.material = boardMaterial;
    }

    private createPaddles(scene: BABYLON.Scene, configuration: GameConfig) {
        const numOfPlayers = 2;
        let result: Array<BABYLON.Mesh>;
        result = new Array(numOfPlayers);
        // result[0] is the left paddle
        for (let i = 0; i < numOfPlayers; i++) {
            result[i] = BABYLON.MeshBuilder.CreateBox("paddle" + i, {
                width: configuration.PADDLE_WIDTH,
                height: configuration.PADDLE_HEIGHT,
                depth: configuration.BALL_RADIUS
            }, scene);
            result[i].position.z = -configuration.PADDLE_WIDTH / 2;
        }
        return result;
    }
}