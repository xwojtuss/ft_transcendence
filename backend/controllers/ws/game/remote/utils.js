import { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS } from '../local/gameConfig.js';

export const sessions = new Map();

export const SEND_TIMEOUT_MS = 5000;
export const BROADCAST_INTERVAL = 2; // broadcast co N ticków

const WS_OPEN = 1;

export function generateId() {
    return Math.random().toString(36).slice(2);
}

function safeSerialize(obj) {
    try {
        return JSON.stringify(obj);
    } catch (e) {
        return null;
    }
}

export function sendSafe(socket, payload) {
    if (!socket || socket.readyState !== WS_OPEN) return;
    const serialized = safeSerialize(payload);
    if (!serialized) return;
    try {
        socket.send(serialized);
    } catch (err) { /* best-effort */ }
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
    if (!session || !session.players || session.players.length === 0) return;

    const payload = { type: "state", state: gameState };
    const serialized = safeSerialize(payload);
    if (!serialized) return;

    for (let i = 0; i < session.players.length; i++) {
        const p = session.players[i];
        if (!p || p.removed || !p.connected || !p.socket) continue;
        if (p.socket.readyState !== WS_OPEN) continue;
        try {
            p.socket.send(serialized);
        } catch (err) { /* best-effort */ }
    }
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
