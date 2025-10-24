import { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS } from '../local/gameConfig.js';

export function createRemoteGameState() {
    return {
        players: {
            1: {
                x: 1 + PADDLE_WIDTH / 2,
                y: FIELD_HEIGHT / 2,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
                score: 0,
                dy: 0,
                nick: '',
                connected: false,
                removed: false
            },
            2: {
                x: FIELD_WIDTH - 1 - PADDLE_WIDTH / 2,
                y: FIELD_HEIGHT / 2,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
                score: 0,
                dy: 0,
                nick: '',
                connected: false,
                removed: false
            },
        },
        ball: {
            x: FIELD_WIDTH / 2 - BALL_RADIUS / 2,
            y: FIELD_HEIGHT / 2 - BALL_RADIUS / 2,
            radius: BALL_RADIUS,
            dx: 0,
            dy: 0
        },
        gameStarted: false,
        gameInitialized: false,
        gameEnded: false,
        winner: null,
        winnerNick: null
    };
}