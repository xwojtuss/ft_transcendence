import { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS } from '../local/gameConfig.js';

export const sessions = new Map();

export const SEND_TIMEOUT_MS = 5000;
export const BROADCAST_INTERVAL = 2; // broadcast co N ticków

export function generateId() {
    return Math.random().toString(36).slice(2);
}

export function sendSafe(socket, payload) {
    try {
        socket.send(JSON.stringify(payload));
    } catch (err) { /* ignore */ }
}

export function sendConfig(socket) {
    sendSafe(socket, {
        type: "config",
        config: { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS }
    });
}

export function sendState(socket, state) {
    sendSafe(socket, { type: "state", state });
}

export function broadcastRemoteGameState(gameState, session) {
    session.players.forEach(p => {
        if (p.connected && !p.removed && p.socket && p.socket.readyState === 1) {
            try {
                p.socket.send(JSON.stringify({ type: "state", state: gameState }));
            } catch (err) { /* ignore */ }
        }
    });
}

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
        winnerNick: null,
        type: "state"
    };
}
