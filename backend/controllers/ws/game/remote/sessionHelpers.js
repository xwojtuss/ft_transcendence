import { generateId, sessions } from './utils.js';

function createSession() {
    const id = generateId();
    const session = { id, players: [], gameState: {}, lastUpdate: Date.now() };
    sessions.set(id, session);
    return session;
}

export function findOrCreateSessionForPlayer(playerId) {
    let waitingSession = null;

    for (const session of sessions.values()) {
        // If player already in session — return it
        if (session.players.some(p => p.id === playerId)) return session;

        // Remember the first matching session with one connected player
        if (!waitingSession && session.players.length === 1 && session.players[0].connected) {
            waitingSession = session;
        }
    }

    return waitingSession || createSession();
}
