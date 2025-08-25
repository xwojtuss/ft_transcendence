import { FPS, FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_SIZE } from './gameConfig.js';
import { gameState, resetGameState } from './gameState.js';
import { updateGame, startGame } from './gameLogic.js';
import { addClient, removeClient, broadcastGameState } from './clientManager.js';

let lastUpdateTime = Date.now();

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    updateGame(deltaTime, () => broadcastGameState(gameState));
}

export function handleConnection(connection) {
    const socket = connection.socket || connection;
    
    addClient(socket);

    // Send game configuration
    socket.send(JSON.stringify({ 
        type: "gameConfig", 
        config: { 
            FIELD_WIDTH, 
            FIELD_HEIGHT,
            PADDLE_HEIGHT,
            PADDLE_WIDTH,
            BALL_SIZE
        } 
    }));

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            if (data.type === "keydown") {
                if (!gameState.gameEnded) {
                    if (["w", "s"].includes(data.key)) {
                        gameState.players[1].dy = data.key === "w" ? -1 : 1;
                    }
                    if (["ArrowUp", "ArrowDown"].includes(data.key)) {
                        gameState.players[2].dy = data.key === "ArrowUp" ? -1 : 1;
                    }
                }
                
                if (data.key === " " && (!gameState.gameInitialized || gameState.gameEnded)) {
                    if (gameState.gameEnded) {
                        resetGameState();
                    } else {
                        startGame();
                    }
                }
            }
            
            if (data.type === "keyup") {
                if (!gameState.gameEnded) {
                    if (["w", "s"].includes(data.key)) gameState.players[1].dy = 0;
                    if (["ArrowUp", "ArrowDown"].includes(data.key)) gameState.players[2].dy = 0;
                }
            }
        } catch (error) {
            console.log('Error parsing message:', error.message);
        }
    });

    socket.on('close', () => {
        removeClient(socket);
    });

    socket.on('error', (error) => {
        console.log('WebSocket error:', error.message);
        removeClient(socket);
    });
}

export function startLocalGameLoop() {
    lastUpdateTime = Date.now();
    setInterval(gameLoop, 1000 / FPS);
}