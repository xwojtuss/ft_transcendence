import { FPS, FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS } from './gameConfig.js';
import { resetGameState } from './gameState.js';
import { updateGame, startGame } from './gameLogic.js';
import { createSession, getSession, removeSession, getAllSessions } from './sessionManager.js';

function broadcastToSession(sessionId, gameState) {
    const session = getSession(sessionId);
    if (session && session.socket && session.socket.readyState === 1) {
        try {
            session.socket.send(JSON.stringify({ type: "state", state: gameState }));
        } catch (error) {
            //console.log(`Error sending to session ${sessionId}:`, error.message);
            removeSession(sessionId);
        }
    }
}

export function handleConnection(connection) {
    const socket = connection.socket || connection;
    
    // Create unique session for each connection
    const sessionId = createSession(socket);
    const session = getSession(sessionId);
    
    if (!session) {
        console.error('Failed to create session');
        return;
    }

    // Send game configuration
    socket.send(JSON.stringify({ 
        type: "gameConfig", 
        config: { 
            FIELD_WIDTH, 
            FIELD_HEIGHT,
            PADDLE_HEIGHT,
            PADDLE_WIDTH,
            BALL_RADIUS
        } 
    }));

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            const currentSession = getSession(sessionId);
            
            if (!currentSession) return;
            
            const { gameState } = currentSession;
            
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
                        resetGameState(gameState);
                    } else {
                        startGame(gameState);
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
            //console.log('Error parsing message:', error.message);
        }
    });

    socket.on('close', () => {
        removeSession(sessionId);
    });

    socket.on('error', (error) => {
        //console.log('WebSocket error:', error.message);
        removeSession(sessionId);
    });
}

export function startLocalGameLoop() {
    let lastUpdateTime = Date.now();
    
    setInterval(() => {
        const now = Date.now();
        const deltaTime = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;

        // Update each active session
        for (const [sessionId, session] of getAllSessions()) {
            session.lastUpdateTime = now;
            updateGame(
                session.gameState, 
                deltaTime, 
                () => broadcastToSession(sessionId, session.gameState)
            );
        }
    }, 1000 / FPS);
}