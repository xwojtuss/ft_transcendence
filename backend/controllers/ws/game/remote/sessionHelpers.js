import { generateId, sessions } from './utils.js';

function findSessionByPlayer(playerId) {
    for (const session of sessions.values()) {
        if (session.players.some(p => p.id === playerId)) return session;
    }
    return null;
}

function findWaitingSession() {
    for (const session of sessions.values()) {
        if (session.players.length === 1 && session.players[0].connected) return session;
    }
    return null;
}

function createSession() {
    const id = generateId();
    const session = { id, players: [], gameState: {}, lastUpdate: Date.now() };
    sessions.set(id, session);
    return session;
}

export function findOrCreateSessionForPlayer(playerId) {
    return findSessionByPlayer(playerId) || findWaitingSession() || createSession();
}
