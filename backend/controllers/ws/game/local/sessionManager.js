import { createGameSession } from './gameState.js';

const sessions = new Map();
let sessionIdCounter = 0;

// Dla lokalnej gry (AI/single)
export function createSession(socket) {
    const sessionId = ++sessionIdCounter;
    const gameState = createGameSession();
    
    sessions.set(sessionId, {
        gameState,
        socket,
        lastUpdateTime: Date.now()
    });
    
    socket.sessionId = sessionId;
    return sessionId;
}

export function createRemoteSession() {
    const sessionId = "remote_" + Math.floor(Math.random() * 1000000);
    const session = {
        sessionId,
        players: [],
        lastUpdateTime: Date.now()
    };
    sessions.set(sessionId, session);
    return sessionId;
}

export function getSession(sessionId) {
    return sessions.get(sessionId);
}

export function removeSession(sessionId) {
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
    }
}

export function getAllSessions() {
    return sessions;
}

export function cleanupInactiveSessions() {
    const now = Date.now();
    const TIMEOUT = 30 * 1000;
    for (const [sessionId, session] of sessions) {
        if (now - session.lastUpdateTime > TIMEOUT) {
            removeSession(sessionId);
        }
    }
}
