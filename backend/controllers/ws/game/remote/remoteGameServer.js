import {
    FPS, FIELD_WIDTH, FIELD_HEIGHT,
    PADDLE_HEIGHT, PADDLE_WIDTH, BALL_SIZE
} from '../local/gameConfig.js';

const sessions = new Map();

function generateId() {
    return Math.random().toString(36).slice(2);
}

// --- GAMELOOP ---

function findOrCreateSessionForPlayer(playerId, socket) {
    // 1. Look for a session where the player already exists (reconnect)
    for (const session of sessions.values()) {
        const idx = session.players.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            return session;
        }
    }
    // 2. Look for a session with one player (waiting for opponent)
    for (const session of sessions.values()) {
        if (session.players.length === 1 && session.players[0].connected) {
            return session;
        }
    }
    // 3. No session with one player, create a new one
    const sessionId = generateId();
    const session = {
        id: sessionId,
        players: [],
        gameState: {}
    };
    sessions.set(sessionId, session);
    return session;
}

export function handleRemoteConnection(connection, req) {
    const socket = connection.socket || connection;
    const playerId = req.query.playerId;

    // Ask game loop for the session to join
    let session = findOrCreateSessionForPlayer(playerId, socket);

    // Check if the player is already in this session (reconnect)
    const existingIdx = session.players.findIndex(p => p.id === playerId);
    if (existingIdx !== -1) {
        // Reconnect
        const player = session.players[existingIdx];
        player.socket = socket;
        player.connected = true;
        player.lastDisconnect = null;
        player.removed = false; // <-- PRZYWRÓĆ GRACZA!
        socket.playerId = existingIdx + 1;
        socket.playerNumber = player.playerNumber;

        // Add new close handler for the new socket
        socket.on('close', () => {
            const idx = session.players.findIndex(p => p.id === playerId);
            if (idx !== -1) {
                session.players[idx].connected = false;
                session.players[idx].lastDisconnect = Date.now();
                console.log(`[DEBUG] Player ${playerId} disconnected from session ${session.id}`);
            }
        });

        socket.send(JSON.stringify({
            type: "reconnected",
            message: "Reconnected to session.",
            players: session.players.filter(p => !p.removed).length,
            playerId: socket.playerNumber,
            sessionId: session.id
        }));
        return;
    }

    // Add new player
    if (session.players.filter(p => !p.removed).length < 2) {
        session.players.push({
            id: playerId,
            socket,
            connected: true,
            lastDisconnect: null,
            playerNumber: session.players.length + 1,
            removed: false
        });
        socket.playerId = session.players.length;
        if (session.players.length === 1) {
            socket.send(JSON.stringify({
                type: "waiting",
                message: "Waiting for opponent...",
                players: 1,
                playerId: 1,
                sessionId: session.id
            }));
        } else if (session.players.length === 2) {
            session.players.forEach((p, idx) => {
                p.socket.send(JSON.stringify({
                    type: "ready",
                    message: "Enemy found! Starting game...",
                    players: 2,
                    playerId: idx + 1,
                    sessionId: session.id
                }));
            });
        }
    } else {
        socket.send(JSON.stringify({ type: "error", message: "Session full or not found" }));
        socket.close();
        return;
    }

    socket.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === "clientDisconnecting") {
            console.log(`[DEBUG] Player ${playerId} is leaving or refreshing`);
            const idx = session.players.findIndex(p => p.id === playerId);
            if (idx !== -1) {
                session.players[idx].connected = false;
                session.players[idx].lastDisconnect = Date.now();
            }
        }
    });

    socket.on('close', () => {
        console.log(`[DEBUG] socket closed for player ${playerId}`);
    });
}

// --- GAMELOOP ---
export function startRemoteGameLoop() {
    setInterval(() => {
        for (const [sessionId, session] of sessions.entries()) {
            // Debug: print player states
            session.players.forEach((p, idx) => {
                console.log(`[DEBUG] Session ${sessionId} - Player ${idx}: id=${p.id}, connected=${p.connected}, lastDisconnect=${p.lastDisconnect}, removed=${p.removed}`);
            });

            // Remove disconnected players after timeout (set removed flag)
            session.players.forEach(p => {
                if (!p.connected && p.lastDisconnect && Date.now() - p.lastDisconnect > 5000 && !p.removed) {
                    p.removed = true;
                    console.log(`[DEBUG] Marking player as removed: ${p.id} from session ${sessionId} after timeout`);
                }
            });

            // Remove empty sessions (all players removed)
            if (session.players.every(p => p.removed)) {
                sessions.delete(sessionId);
                console.log(`[DEBUG] Empty session removed: ${sessionId}`);
                continue;
            }
        }
    }, 1000 / FPS);
}
