import { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS } from './gameConfig.js';

function createInitialGameState() {
    return {
        players: {
            1: { x: 1 + PADDLE_WIDTH / 2, y: FIELD_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, score: 0, dy: 0 },
            2: { x: FIELD_WIDTH - 1 - PADDLE_WIDTH / 2, y: FIELD_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, score: 0, dy: 0 },
        },
        ball: {
            x: FIELD_WIDTH / 2,
            y: FIELD_HEIGHT / 2,
            radius: BALL_RADIUS,
            dx: 0,
            dy: 0
        },
        gameStarted: false,
        gameInitialized: false,
        gameEnded: false,
        winner: null
    };
}

export function createGameSession() {
    return createInitialGameState();
}

export function resetGameState(gameState) {
    // Reset player scores
    gameState.players[1].score = 0;
    gameState.players[2].score = 0;

    // Reset positions
    gameState.players[1].y = FIELD_HEIGHT / 2;
    gameState.players[2].y = FIELD_HEIGHT / 2;
    gameState.players[1].dy = 0;
    gameState.players[2].dy = 0;

    // Reset ball
    gameState.ball.x = FIELD_WIDTH / 2;
    gameState.ball.y = FIELD_HEIGHT / 2;
    gameState.ball.dx = 0;
    gameState.ball.dy = 0;

    // Reset game states
    gameState.gameStarted = false;
    gameState.gameInitialized = false;
    gameState.gameEnded = false;
    gameState.winner = null;
}
