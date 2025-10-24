import { FIELD_WIDTH, FIELD_HEIGHT } from '../local/gameConfig.js';

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
    sendSafe(socket, { type: "config", FIELD_WIDTH, FIELD_HEIGHT });
}

export function sendState(socket, state) {
    sendSafe(socket, { type: "state", state });
}
