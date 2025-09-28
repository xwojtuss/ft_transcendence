import { createGameSession } from './gameState.js';

const sessions = new Map();
let sessionIdCounter = 0;

export function createSession(socket) {
    const sessionId = ++sessionIdCounter;
    const gameState = createGameSession();
    
    sessions.set(sessionId, {
        gameState,
        socket,
        lastUpdateTime: Date.now()
    });
    
    socket.sessionId = sessionId;
    
    //console.log(`Created game session ${sessionId}. Total sessions: ${sessions.size}`);
    return sessionId;
}

export function getSession(sessionId) {
    return sessions.get(sessionId);
}

export function removeSession(sessionId) {
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        //console.log(`Removed game session ${sessionId}. Total sessions: ${sessions.size}`);
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
