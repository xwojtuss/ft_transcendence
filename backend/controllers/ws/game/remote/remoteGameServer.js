import { getUserSession } from '../../../view/viewUtils.js';

import {
    FPS, FIELD_WIDTH, FIELD_HEIGHT,
    PADDLE_HEIGHT, PADDLE_WIDTH, BALL_SIZE
} from '../local/gameConfig.js';

import { createRemoteGameState } from './remoteGameState.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { startGame, updateGame } from '../local/gameLogic.js';

const sessions = new Map();

function generateId() {
    return Math.random().toString(36).slice(2);
}

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
        gameState: {},
        lastUpdate: Date.now()
    };
    sessions.set(sessionId, session);
    return session;
}

function setupSocketHandlers(socket, session, playerId) {
    socket.on('message', (msg) => {
        const data = JSON.parse(msg);
        const idx = session.players.findIndex(p => p.id === playerId);
        if (data.type === "clientDisconnecting") {
            console.log(`[DEBUG] Player ${playerId} is leaving or refreshing`);
            if (idx !== -1) {
                session.players[idx].connected = false;
                session.players[idx].lastDisconnect = Date.now();
            }
            return;
        }

        // Input handling: keydown/keyup from frontend
        if ((data.type === 'keydown' || data.type === 'keyup') && idx !== -1) {
            const key = data.key;
            const sessionPlayer = session.players[idx];
            const playerNumber = sessionPlayer.playerNumber;

            // If gameState not created yet, ignore inputs safely
            if (!session.gameState || !session.gameState.players || !session.gameState.players[playerNumber]) {
                return;
            }

            const gsPlayer = session.gameState.players[playerNumber];
            if (!gsPlayer.keyState) gsPlayer.keyState = { up: false, down: false };

            const isDown = data.type === 'keydown';
            if (key === 'w' || key === 'ArrowUp') {
                gsPlayer.keyState.up = isDown;
            } else if (key === 's' || key === 'ArrowDown') {
                gsPlayer.keyState.down = isDown;
            }

            // compute dy: -1 for up, +1 for down, 0 if both or none
            const up = gsPlayer.keyState.up ? 1 : 0;
            const down = gsPlayer.keyState.down ? 1 : 0;
            gsPlayer.dy = (down - up);
            return;
        }
    });

    socket.on('close', () => {
        const idx = session.players.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            session.players[idx].connected = false;
            session.players[idx].lastDisconnect = Date.now();
            console.log(`[DEBUG] Player ${playerId} disconnected from session ${session.id}`);
        }
    });
}

function reconnectPlayer(session, socket, playerId, existingIdx) {
    const player = session.players[existingIdx];
    player.socket = socket;
    player.connected = true;
    player.lastDisconnect = null;
    player.removed = false;
    socket.playerId = existingIdx + 1;
    socket.playerNumber = player.playerNumber;
    setupSocketHandlers(socket, session, playerId);

    socket.send(JSON.stringify({
        type: "reconnected",
        message: "Reconnected to session.",
        players: session.players.filter(p => !p.removed).length,
        playerId: socket.playerNumber,
        sessionId: session.id
    }));

    // If the game state already exists, send the current state and game config to the reconnected player
    if (session.gameState) {
        try {
            socket.send(JSON.stringify({ type: "state", state: session.gameState }));
            socket.send(JSON.stringify({ type: "config", width: FIELD_WIDTH, height: FIELD_HEIGHT }));
        } catch (err) {
            // ignore
        }
    }
}

function addNewPlayer(session, socket, playerId, fastify) {
    const playerNumber = session.players.length + 1;
    const playerNick = getUserSession(fastify).nickname;
    session.players.push({
        id: playerId,
        socket,
        connected: true,
        lastDisconnect: null,
        playerNumber,
        removed: false,
        nick: playerNick
    });
    socket.playerId = session.players.length;
    socket.playerNumber = playerNumber;
    setupSocketHandlers(socket, session, playerId);

    if (session.players.length === 1) {
        socket.send(JSON.stringify({
            type: "waiting",
            message: "Waiting for opponent...",
            players: 1,
            playerId: 1,
            sessionId: session.id
        }));
        // Send game config so the lone player can size the canvas correctly
        try {
            socket.send(JSON.stringify({ type: "config", width: FIELD_WIDTH, height: FIELD_HEIGHT }));
        } catch (err) {
            // ignore send errors
        }
    } else if (session.players.length === 2) {
        session.players.forEach((p, idx) => {
            try {
                p.socket.send(JSON.stringify({
                    type: "ready",
                    message: "Enemy found! Starting game...",
                    players: 2,
                    playerId: idx + 1,
                    sessionId: session.id
                }));
            } catch (err) {
                // ignore
            }
        });

        // Send game config (field dimensions) so the frontend can size the canvas correctly
        session.players.forEach((p) => {
            try {
                p.socket.send(JSON.stringify({ type: "config", width: FIELD_WIDTH, height: FIELD_HEIGHT }));
            } catch (err) {
                // ignore
            }
        });

        // Initialize game state for this session and broadcast it so clients can render players/ball/score
        try {
            session.gameState = createRemoteGameState();
            // copy connected/removed/nick info into gameState players
            session.players.forEach((p, idx) => {
                const playerNumber = idx + 1;
                if (session.gameState.players[playerNumber]) {
                    session.gameState.players[playerNumber].connected = !!p.connected;
                    session.gameState.players[playerNumber].removed = !!p.removed;
                    session.gameState.players[playerNumber].nick = p.nick;
                }
            });
            // Broadcast initial state
            broadcastRemoteGameState(session.gameState, session);

            // Auto-start the game after 3 seconds
            setTimeout(() => {
                if (!session.gameState) return;
                // startGame will set initial ball dx/dy and mark started/initialized
                startGame(session.gameState);
                // send state immediately after starting
                broadcastRemoteGameState(session.gameState, session);
            }, 3000);
        } catch (err) {
            // ignore
        }
    }
}

function handleSessionFull(socket) {
    socket.send(JSON.stringify({ type: "error", message: "Session full or not found" }));
    socket.close();
}

export function handleRemoteConnection(connection, req, fastify) {
    const socket = connection.socket || connection;
    const playerId = req.query.playerId;

    // Ask game loop for the session to join
    let session = findOrCreateSessionForPlayer(playerId, socket);

    // Check if the player is already in this session (reconnect)
    const existingIdx = session.players.findIndex(p => p.id === playerId);
    if (existingIdx !== -1) {
        // Reconnect
        reconnectPlayer(session, socket, playerId, existingIdx);
        return;
    }

    // Add new player
    if (session.players.filter(p => !p.removed).length < 2) {
        addNewPlayer(session, socket, playerId, fastify);
    } else {
        handleSessionFull(socket);
    }
}

// --- GAMELOOP ---
export function startRemoteGameLoop() {
    setInterval(() => {
        for (const [sessionId, session] of sessions.entries()) {
            // Debug: print player states
            session.players.forEach((p, idx) => {
                console.log(`[DEBUG] Session ${sessionId}
                    Player ${idx}: id=${p.id}, connected=${p.connected}, lastDisconnect=${p.lastDisconnect},
                    removed=${p.removed},
                    playerNick=${p.nick}`);
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

            // Sprawdź czy jeden gracz jest połączony, a drugi rozłączony (ale nie usunięty)
            const activePlayers = session.players.filter(p => p.connected && !p.removed);
            const disconnectedPlayers = session.players.filter(p => !p.connected && !p.removed);

            // Waiting info
            if (
                activePlayers.length === 1 &&
                disconnectedPlayers.length === 1
            ) {
                const player = activePlayers[0];
                player.socket.send(JSON.stringify({
                    type: "waiting",
                    message: "Waiting for opponent to reconnect...",
                    players: session.players.filter(p => !p.removed).length,
                    playerId: player.playerNumber,
                    sessionId
                }));
            }

            // Ready info (obaj połączeni)
            if (
                activePlayers.length === 2 &&
                session.players.filter(p => !p.removed).length === 2
            ) {
                session.players.forEach((p, idx) => {
                    if (p.connected && !p.removed) {
                        p.socket.send(JSON.stringify({
                            type: "ready",
                            message: "Opponent reconnected! Game starting...",
                            players: 2,
                            playerId: p.playerNumber,
                            sessionId
                        }));
                    }
                });
            }

            // Update and broadcast current game state (if created) so clients receive updated positions
            if (session.gameState) {
                try {
                    const now = Date.now();
                    if (!session.lastUpdate) session.lastUpdate = now;
                    const dt = (now - session.lastUpdate) / 1000; // seconds
                    session.lastUpdate = now;

                    try {
                        updateGame(session.gameState, dt, () => {});
                    } catch (err) {
                        // swallow update errors to keep loop running
                    }

                    broadcastRemoteGameState(session.gameState, session);
                } catch (err) {
                    // ignore
                }
            }
        }
    }, 1000 / FPS);
}
